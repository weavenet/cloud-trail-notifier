#!/bin/bash

dir=$TMPDIR
file=$dir/deploy.zip
function=CloudTrailNotifier
action=$1

echo "Setting up tests."
result=`npm install`
if [ $? -ne 0 ]; then
	echo $result
	echo "Error setting up tests."
	exit 1
fi

echo "Running tests."
result=`npm test`
if [ $? -ne 0 ]; then
	echo $result
	echo "Error running tests."
	exit 1
fi

echo "Removing node_modules"
\rm -rf node_modules

echo "Getting dependencies"
result=`npm install --production`
if [ $? -ne 0 ]; then
	echo $result
	echo "Error installing modules"
	exit 1
fi

echo "Building zip file."
result=`zip -r $file CloudTrailNotifier.js config.json node_modules`
if [ $? -ne 0 ]; then
	echo $result
	echo "Error building zip."
	exit 1
fi

echo "Build located @ $file"
if [ "$action" == "deploy" ]; then
	echo "Updating function $function"
	result=`aws lambda update-function-code --function-name $function --zip-file fileb://$file`
	if [ $? -ne 0 ]; then
		echo $result
		echo "Error upading function $function."
		exit 1
	fi
	echo "Deployed succesfully."
fi
