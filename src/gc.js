const { consola } = require('consola');
const { CloudFormation } = require('@aws-sdk/client-cloudformation');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');
const { STS } = require('@aws-sdk/client-sts');
const { S3 } = require('@aws-sdk/client-s3');

/**
 * @param client {CloudFormation}
 * @param nextToken {string | undefined}
 * @return {import('@aws-sdk/client-cloudformation').StackSummary[]}
 */
async function* listStacks(client, nextToken = undefined) {
  const {
    StackSummaries,
    NextToken
  } = await client.listStacks({
    StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE'],
    NextToken: nextToken
  });
  for (const stack of StackSummaries) {
    yield stack;
  }
  if (NextToken) {
    yield* listStacks(client, NextToken);
  }
}

/**
 *
 * @param client {CloudFormation}
 * @param stack {import('@aws-sdk/client-cloudformation').StackSummary}
 * @return {Promise<any>}
 */
async function getTemplateAsJson(client, stack) {
  const { TemplateBody } = await client.getTemplate({ StackName: stack.StackName, TemplateStage: 'Processed' });
  try {
    return JSON.parse(TemplateBody);
  } catch (e) {
    return null;
  }
}

/**
 * @param client {S3}
 * @param bucket {string}
 * @param keyMarker {string | undefined}
 * @param versionIdMarker {string | undefined}
 * @return {import('@aws-sdk/client-s3').ObjectVersion[]}
 */
async function* listObjectVersions(client, bucket, keyMarker = undefined, versionIdMarker = undefined) {
  const {
    Versions,
    NextKeyMarker,
    NextVersionIdMarker,
  } = await client.listObjectVersions({
    Bucket: bucket,
    KeyMarker: keyMarker,
    VersionIdMarker: versionIdMarker
  });
  for (const object of Versions) {
    yield object;
  }
  if (NextKeyMarker && NextVersionIdMarker) {
    yield* listObjectVersions(client, bucket, NextKeyMarker, NextVersionIdMarker);
  }
}

/**
 *
 * @param sdkConfig {any}
 * @return {CloudFormation}
 */
function getCloudFormation(sdkConfig) {
  return new CloudFormation(sdkConfig);
}

/**
 *
 * @param sdkConfig {any}
 * @return {S3}
 */
function getS3(sdkConfig) {
  return new S3(sdkConfig);
}

/**
 * @param sdkConfig {any}
 * @return {Promise<string>}
 */
async function getAccountId(sdkConfig) {
  const { Account } = await new STS(sdkConfig).getCallerIdentity();
  return Account;
}

/**
 * @param name {string}
 * @param accountId {string}
 * @param region {string}
 * @return {string}
 */
function parseBucket(name, { accountId, region }) {
  return name.replace('${AWS::AccountId}', accountId).replace('${AWS::Region}', region);
}

/**
 * @param template {any}
 * @param context {any}
 * @return {[string,string][]}
 */
function extractLambdaAssets(template, context) {
  const lambdas = Object.values(template.Resources).filter(resource => resource.Type === 'AWS::Lambda::Function');
  const s3Assets = lambdas.map(lambda => lambda.Properties.Code).filter(asset => asset?.S3Bucket);

  return s3Assets.map(asset => {
    const isString = typeof asset.S3Bucket === 'string';
    const s3Bucket = isString ? asset.S3Bucket : asset.S3Bucket['Fn::Sub'];

    const bucket = parseBucket(s3Bucket, context);
    const key = asset.S3Key;
    return [bucket, key];
  });
}

/**
 * @param template {any}
 * @param context {any}
 */
function extractAssets(template, context) {
  const lambdaAssets = extractLambdaAssets(template, context);

  return [...lambdaAssets];
}

function getCredentials(args) {
  const { profile } = args;
  if (profile) return fromIni({ profile });
  return fromEnv();
}

/**
 *
 * @param ctx {import('citty').CommandContext}
 * @return {Promise<void>}
 */
module.exports.gc = async function (ctx) {
  const { args } = ctx;
  const { region, templates: excludeTemplates } = args;
  const credentials = getCredentials(args);
  const sdkConfig = { region, credentials };

  consola.start('Setting up...');

  const cloudformation = getCloudFormation(sdkConfig);
  const s3 = getS3(sdkConfig);
  const accountId = await getAccountId(sdkConfig);

  const context = { accountId, region };

  consola.start('Fetching stacks...');
  const assetsInUse = [];
  for await (const stack of listStacks(cloudformation)) {
    const template = await getTemplateAsJson(cloudformation, stack);
    if (template?.Parameters?.BootstrapVersion) {
      const assets = extractAssets(template, context);
      consola.log(' ', stack.StackName, 'has', assets.length, 'assets');
      assetsInUse.push(...assets);
    }
  }

  const assetsGroupedByBucket = assetsInUse.reduce((acc, [bucket, key]) => {
    acc[bucket] = acc[bucket] ?? [];
    acc[bucket].push(key);
    return acc;
  }, {});

  consola.start('Fetching s3 assets...');

  const removedAssets = [];
  for (const [bucket, assetsToKeep] of Object.entries(assetsGroupedByBucket)) {
    consola.log(' Listing files from ', bucket);
    for await (const object of listObjectVersions(s3, bucket)) {
      if (assetsToKeep.includes(object.Key)) continue; // skip assets in use

      const isZipFile = object.Key.endsWith('.zip');
      const isJsonFile = object.Key.endsWith('.json');
      if (isZipFile || (isJsonFile && excludeTemplates)) {
        consola.log(' ', 'Deleting', object.Key, object.VersionId);
        removedAssets.push(object.Key);
        if (args.yes) {
          await s3.deleteObject({
            Bucket: bucket,
            Key: object.Key,
            VersionId: object.VersionId
          });
        }
      }
    }
  }

  console.log('Removed', removedAssets.length, 'assets');
  consola.success('Done');
};