var path = require('path');
var fs = require('fs');

var AWS = require('aws-sdk');

var s3 = new AWS.S3();
var ffmpeg = require('fluent-ffmpeg');


exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event, null, 4));
    
    let snsPayload = JSON.parse(event.Records[0].Sns.Message).Records[0];
    let bucket = snsPayload.s3.bucket.name;
    let object = snsPayload.s3.object.key;
    let s3Params = {
        Bucket: bucket,
        Key: object
    };
    let vidFname = '/tmp/' + path.basename(object);
    var thumbnailMs = Number(process.env.thumbnailLength) || 2000;
    var thumbnailSec = thumbnailMs / 1000;
    var parsedFname = path.parse(vidFname);
    var seekPoint = 0;
    
    s3.getObject(s3Params, function(err, data) {
        if (err) {
            console.error(err.code, "-", err.message);
            return callback(err);
        }
        fs.writeFile(vidFname, data.Body, function(err) {
            if(err) {
                console.log(err.code, "-", err.message);
                return callback(err);
            }
        });
    });
    
    ffmpeg.ffprobe(vidFname, function(err, metadata) {
        if (err) {
            console.error(err.code, "-", err.message);
            return callback(err);
        }
        console.dir(metadata);
        seekPoint = (metadata.format.duration - thumbnailSec)/2;
    
    	if (seekPoint > 0) {
    		console.log('I will convert to gif');
    		gifHandler(vidFname, seekPoint, thumbnailSec, parsedFname);
    	} else {
    		console.log('I will convert to img');
    		seekPoint = metadata.format.duration/2;
    		imgHandler(vidFname, seekPoint, parsedFname);
    	}
    });
    
    function imgHandler(vidFname, seekPoint, parsedFname) {
    	var renderedFname = parsedFname.dir + '/' + parsedFname.name + '.jpg';
    	ffmpeg()
    		.input(vidFname)
    		.seekInput(seekPoint)
    		.addOutputOption(['-vframes 1', '-q:v 2'])
    		.on('start', function(cmd) {
    			console.log('Beginning img creation:\n\t' + cmd);
    		})
    		.on('end', function() {
    			console.log('IMG created');
    			putObjectToS3(parsedFname.name + '.jpg', renderedFname);
    		})
    		.on('error', function(error) {
    			console.log('ERROR creating img: ' + error);
    		})
    		.output(renderedFname)
    		.run();
    }
    
    
    function gifHandler(vidFname, seekPoint, thumbnailSec, parsedFname) {
    	var renderedFname = parsedFname.dir + '/' + parsedFname.name + '.gif';
    	ffmpeg()
    		.input(vidFname)
    		.seekInput(seekPoint)
    		.inputOptions('-t ' + thumbnailSec)
    		.addOutputOption('-f gif')
    		.on('start', function(cmd) {
    			console.log('Beginning gif creation:\n\t' + cmd);
    		})
    		.on('end', function() {
    			console.log('GIF created');
    			reverseGif(renderedFname, parsedFname);
    		})
    		.on('error', function(error) {
    			console.log('ERROR creating gif: ' + error);
    		})
    		.output(renderedFname)
    		.run();
    }
    
    // Convert video to gif & concat with itself in reverse order
    // https://stackoverflow.com/questions/42257354/concat-a-video-with-itself-but-in-reverse-using-ffmpeg#comment79872823_42257863
    // ffmpeg -i 2.gif -filter_complex "[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]" -map "[v]" merge.gif
    
    function reverseGif(gifFname, parsedFname) {
    	var renderedFname = parsedFname.dir + '/' + parsedFname.name + '_reversed_' + '.gif';
    	ffmpeg()
    		.input(gifFname)
    		.complexFilter('[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]', ['v'])
    		.on('start', function(cmd) {
    			console.log('Reversing gif:\n\t' + cmd);
    		})
    		.on('end', function() {
    			console.log('GIF reversed');
    			putObjectToS3(parsedFname.name + '_reversed_' + '.gif', renderedFname);
    		})
    		.on('error', function(error) {
    			console.log('ERROR reversing gif: ' + error);
    		})
    		.output(renderedFname)
    		.run();
    }
    
    function putObjectToS3(key, renderedFname) {
        fs.readFile(renderedFname, function (err, data) {
            if (err) {
                console.log(err.code, "-", err.message);
                return callback(err);
            }
            var base64data = new Buffer(data, 'binary');
            var s3Params = {
                Bucket : process.env.targetS3Bucket,
                Key : key,
                Body : base64data
            }
            s3.putObject(s3Params, function(err, data) {
                if(err) {
                    console.log(err.code, "-", err.message);
                    return callback(err);
                } else
                    console.log(data);
            });
        });
    }
    return 0;
};
