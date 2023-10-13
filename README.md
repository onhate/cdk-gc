# cdk-gc

## Overview

`cdk-gc` is a utility CLI tool designed to assist in the cleanup of unused assets in your AWS CloudFormation stacks. It
identifies and removes assets stored in Amazon S3 buckets that are no longer referenced by active stacks.

## Usage

```bash
npx onhate/cdk-gc gc --profile <your-aws-profile> --region <your-aws-region> [--yes]
```

## Options

- --profile: Specify the AWS CLI profile to use for authentication.
- --region: Set the AWS region for the cleanup operation.
- --yes (Optional): Confirm and execute the cleanup without interactive prompts.

*Note*: Use this utility with caution, and thoroughly review the identified assets before confirming the cleanup.