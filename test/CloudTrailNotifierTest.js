var assert = require("assert")
var fs = require('fs');
var sinon = require('sinon');
var zlib = require('zlib');

var cloudTrailNotifier = require(__dirname + '/../CloudTrailNotifier.js');

function exampleObjectData() {
	return zlib.gzipSync(fs.readFileSync(__dirname + "/example_log_file.json"));
}

describe("parsing message and publishing alert", function() {
	var testS3 = {
		getObject: function(options, callback) {
				   callback(null, {Body: exampleObjectData()});
			   }
	}
	var publishSpy = sinon.spy();
	var testSns = { publish: publishSpy };
	var context = { succeed: function(message, err) { } }
	var eventsToAlert = {
		"sts.amazonaws.com": ["AssumeRole"],
                "signin.amazonaws.com": ["ConsoleLogin"]
	}

	before(function() {
		topicArn = "arn:aws:sns:us-west-2:123456123456:CloudTrailNotifier";
		records = JSON.parse(fs.readFileSync(__dirname + "/example_s3_notification.json")).Records;
	});

	it("Should send the expected mesag", function(done) {
		cloudTrailNotifier.processRecords(records, testS3, testSns, topicArn, eventsToAlert, context);
		done();
	});

	after(function() {
		var expectedMsg = [
	  		"Received CloudTrail event: 'AssumeRole' via 'sts.amazonaws.com' @ 2015-05-07T03:41:57Z from IP '1.2.3.4'.",
			"Received CloudTrail event: 'AssumeRole' via 'sts.amazonaws.com' @ 2015-05-17T15:48:03Z from IP '1.2.3.4'.",
		      	"Received CloudTrail event: 'ConsoleLogin' via 'signin.amazonaws.com' @ 2015-05-17T16:57:02Z from IP '1.2.3.4'."].join("\n");
		assert.equal(publishSpy.args[0][0].Message, expectedMsg);
		assert.equal(publishSpy.args[0][0].TopicArn, topicArn);
	});
});
