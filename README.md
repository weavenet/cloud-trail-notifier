# Cloud Trail Notifier

[![Build Status](https://secure.travis-ci.org/brettweavnet/cloud-trail-notifier.png)](http://travis-ci.org/brettweavnet/cloud-trail-notifier)

## Overview

**Cloud Trail Notifier** is an experiment to send alerts based on events you
specify in your AWS account. It is:

* A NodeJS applications which runs on [AWS Lambda](https://aws.amazon.com/lambda/) (No Instances).
* Triggerd by [AWS CloudTrail](https://aws.amazon.com/cloudtrail/) logs being placed
in an [AWS S3](https://aws.amazon.com/s3/) bucket.
* That sends notifications via [AWS SNS](https://aws.amazon.com/sns) in the format below.

Sample notification:

*Received CloudTrail event: 'ConsoleLogin' via 'signin.amazonaws.com' @ 2015-05-18T15:16:43Z from IP '1.2.3.4'.*  
*Received CloudTrail event: 'AssumeRole' via 'sts.amazonaws.com' @ 2015-05-18T15:17:37Z from IP '1.2.3.4'.*

This project is based on the [Handling AWS CloudTrail Events](https://docs.aws.amazon.com/lambda/latest/dg/wt-cloudtrail-events-adminuser.html) walk through.

## Audience

Cloud Trail Notifier is intended for those who:

* Want basic alerts on specific CloudTrail events in an AWS account (Account Created, Console Login, etc).
* Are comfortable working with AWS services.
* Want quick setup, minimal costs and no instances to support.

## Pre-reqs

* NodeJS
* NPM
* AWS CLI installed
* AWS Credentials

# Setup

Clone down this repo, and then set the region where you which to create the resources

```
export AWS_REGION=us-west-2
```

Create an **S3** bucket where you will send your CloudTrail logs.

```
aws s3 mb s3://my-account-cloud-trail-logs
```

Enable **CloudTrail** and send logs to the bucket created above.

```
aws cloudtrail create-trail \
    --name default \
    --s3-bucket-name my-account-cloud-trail-logs
```

Create an **SNS Topic** which will be used to send notifications on the desired logs.

```
aws sns create-topic --name CloudTrailAlerts
```

Subscribe your email address to TopicARN created above.

```
aws sns --topic-arn ARN \
        --protocol email \
        --notification-endpoint user@example.com
```

Update the parameter value below with the bucket name and create the role which will
be used to execute the Lambda function (via Cloud Formation):

```
aws cloudformation create-stack --stack-name CloudTrailNotifierRole \
                                --template-body file://templates/cloud_trail_notifier_role.json \
                                --parameters ParameterKey=BucketName,ParameterValue=my-account-cloud-trail-logs \
                                --capabilities CAPABILITY_IAM
```

Retrieve the name of the new role.

```
aws cloudformation describe-stacks --stack-name CloudTrailNotifierRole
```

Copy the example config and update it (See below under Deploy Code for more info on creating config):

```
cp config.json.example config.json
```

Build zip file of Cloud Trail Notifier swhich will be uploaded to Lambda function.

```
bash script/build.sh
```

Update path to the the zip file and role below and run to create a **Lambda Function**
name **CloudTrailNotifier** which will be executed when new logs are placed in the bucket.

```
aws lambda create-function \
        --region us-west-2 \
        --function-name CloudTrailNotifier  \
        --zip-file fileb://path/to/build.zip \
        --role EXECUTE_ROLE_ARN \
        --handler CloudTrailNotifier.handler \
        --runtime nodejs \
        --timeout 3 \
        --memory-size 128
```

Update the file **notification_configuration.json** with the **RoleARN** and the **LambdaARN**
 and run the below to enable **S3 Bucket Notifications** for new logs to execute the
function created above.

```
aws s3api put-bucket-notification \
        --bucket my-account-cloud-trail-logs \
        --notification-configuration file://templates/notification_configuration.json
```

Do something that should trigger an event and see what happens! If you run into issues,
check **CloudWatch Logs** for the Lambda function's results.

# Build / Deploy

You will need to copy the **config.json.example** file to **config.json**.

This file specifies:

**s3Region**: Region of S3 bucket created above.  
**snsTopicArn**: ARN of the SNS topic created above.  
**events**: Events for which you want to receive a notification.  

Once you have created the config file, execute the deploy script to build the zip
and update the lambda function created above using the **deploy.sh** script:

```
bash script/deploy.sh deploy
```

Perform an action which you expect to generate an event which will send a notification 
and ensure it is received.

# Test

Cloud Trail Notifier uses Mocha for testing.

```
npm install
npm test
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
