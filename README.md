# WARNING

CDK has officially released a gc feature https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-gc.html



# cdk-gc

## Overview

`cdk-gc` is a utility CLI tool designed to assist in the cleanup of unused assets of your CDK AWS CloudFormation stacks. It
identifies and removes assets stored in the CloudFormation Deployment buckets that are no longer referenced by active stacks.

see https://github.com/aws/aws-cdk-rfcs/issues/64

## Usage

```bash
npx onhate/cdk-gc gc --profile <your-aws-profile> --region <your-aws-region> [--yes]
```

## Options

- --profile: Specify the AWS profile to use for authentication. (optional)
- --region: Set the AWS region for the cleanup operation.
- --yes (Optional): Confirm and execute the cleanup (default to dry-run).

*Note*: Use this utility with caution, and thoroughly review the identified assets before confirming the cleanup.
