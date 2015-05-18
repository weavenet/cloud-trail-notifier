var aws = require('aws-sdk');
var fs = require('fs');
var zlib = require('zlib');

function genericMessage(record) {
	return  ["Received CloudTrail event: '", record.eventName, "'",
	         " via '", record.eventSource,
	       	 "' @ ", record.eventTime,
	       	 " from IP '", record.sourceIPAddress, "'."].join("");
}

function alertOnRecord(record, eventsToAlert) {
	var values = eventsToAlert[record.eventSource];
	if (values == undefined) {
		return false
	}
	return (values.indexOf(record.eventName) > -1);
}

function parseMatchingRecords(records, eventsToAlert) {
	return records.Records.filter(function(record) {
		return alertOnRecord(record, eventsToAlert);
	});
}

function publishMessage(matchingRecords, sns, snsTopicArn, context) {
	if (matchingRecords.length > 0) {
		console.log('Publishing ' + matchingRecords.length + ' notification(s) in parallel...');
		var msg = matchingRecords.map(genericMessage).join("\n");

		sns.publish({Message: msg, TopicArn: snsTopicArn},
				function(err, dati) {
					if (err) {
						context.done('Failed to publish notifications. Error: ', err);
					} else {
						context.succeed('Successfully published all notifications.');
					}
				})
	} else {
		context.succeed('No messages to publish');
	}
}

exports.processRecords = function(records, s3, sns, snsTopicArn, eventsToAlert, context) {
    var srcBucket = records[0].s3.bucket.name;
    var srcKey = records[0].s3.object.key;

    console.log("Reading event from", srcBucket, srcKey);

    function publishNotifications(err, jsonBuffer) {
            console.log('Filtering log...');
            var json = jsonBuffer.toString();
            console.log('CloudTrail JSON from S3:', json);

            var records;
            try {
                records = JSON.parse(json);
            } catch (err) {
                context.done("Unable to parse CloudTrail JSON", + err);
		return;
            }

	    console.log("Filtering matching records to alert on.");
            var matchingRecords = parseMatchingRecords(records, eventsToAlert);

	    console.log("Publishing messages to SNS");
	    publishMessage(matchingRecords, sns, snsTopicArn, context);
    }

    function uncompressLog(err, response){
	    console.log("Uncompressing log...");
	    zlib.gunzip(response.Body, publishNotifications);
    }
   
    function processS3Log(){
	    console.log('Fetching compressed log from S3...');
	    s3.getObject({
		    Bucket: srcBucket,
		    Key: srcKey
	    }, uncompressLog);
    }

    processS3Log();
}

function readConfig() {
	return JSON.parse(fs.readFileSync('config.json'));
}

exports.handler = function(event, context) {
	config = readConfig();

	var s3 = new aws.S3({
		region: config.s3Region
	});

	var snsTopicArn = config.snsTopicArn;
	var snsTopicRegion = snsTopicArn.split(":")[3];
	var sns = new aws.SNS({
		apiVersion: '2010-03-31',
	    region: snsTopicRegion
	});

	var eventsToAlert = config.events;

	exports.processRecords(event.Records, s3, sns, snsTopicArn, eventsToAlert, context);
}
