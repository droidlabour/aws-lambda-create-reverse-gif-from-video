var path = require('path');
var fs = require('fs').promises;

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
 
    return getFileFromS3(s3Params, vidFname)
    .then(function() {
        return new Promise(function(resolve, reject) {
            ffmpeg.ffprobe(vidFname, function(err, metadata) {
                if (err) {
                    console.error(err.code, "-", err.message);
                    reject(err);
                }
				console.log(JSON.stringify(metadata, null, 4));
                seekPoint = (metadata.format.duration - thumbnailSec)/2;
            
                resolve({seekPoint: seekPoint, metadata: metadata});
            });
        })
    })
    .then(function(seek) {
        if (seek.seekPoint > 0) {
            console.log('I will convert to gif');
            return gifHandler(vidFname, seek.seekPoint, thumbnailSec/2, parsedFname);
        } else {
            console.log('I will convert to img');
            seekPoint = seek.metadata.format.duration/2;
            return imgHandler(vidFname, seekPoint, parsedFname);
        }
    })
    .then (function(fileObj) {
        return putFileToS3(fileObj.key, fileObj.renderedFname);
    })
    .then (function(success) {
        if (!success) {
            var ex = new Error("Could not save to s3");
            throw ex;
        }
        return 0;
    })
    .catch(function(ex) {
        console.log(ex);
        callback(ex);
    });
};


var getFileFromS3 = function(s3Params, vidFname) {
    var downloadFile = s3.getObject(s3Params).promise();
    return downloadFile.then(function(data) {
        return fs.writeFile(vidFname, data.Body);
    })
    .then(function() {
        return;
    })
    .catch(function(ex) {
        console.log(ex);
        throw ex;
    });
}

var putFileToS3 = function(key, renderedFname) {
    return fs.readFile(renderedFname)
    .then(function(data) {
        var base64data = new Buffer(data, 'binary');
        var s3Params = {
            Bucket : process.env.targetS3Bucket,
            Key : key,
            Body : base64data
        }

        var uploadFile = s3.putObject(s3Params).promise();
        return uploadFile.then(function(data) {
            if (data) {
                return true;
            }
            else {
                return false;
            }
        })
    })
    .catch(function(ex) {
        console.log(ex);
        throw ex;
    });
}


var imgHandler = function(vidFname, seekPoint, parsedFname) {
    return new Promise(function(resolve, reject) {
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
            resolve({key: parsedFname.name + '.jpg', renderedFname: renderedFname});
        })
        .on('error', function(error) {
            console.log('ERROR creating img: ' + error);
            reject(error);
        })
        .output(renderedFname)
        .run();
    })
    .catch(function(ex) {
        console.log(ex);
        throw ex;
    });
}

// Convert video to gif & concat with itself in reverse order
// https://stackoverflow.com/questions/42257354/concat-a-video-with-itself-but-in-reverse-using-ffmpeg#comment79872823_42257863
// ffmpeg -i 2.gif -filter_complex "[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]" -map "[v]" merge.gif
var reverseGif = function(gifFname, parsedFname) {
    return new Promise(function(resolve, reject) {
        var renderedFname = parsedFname.dir + '/' + parsedFname.name + '_reversed_' + '.gif';
        ffmpeg()
        .input(gifFname)
        .complexFilter('[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]', ['v'])
        .on('start', function(cmd) {
            console.log('Reversing gif:\n\t' + cmd);
        })
        .on('end', function() {
            console.log('GIF reversed');
            resolve({key: parsedFname.name + '_reversed_' + '.gif', renderedFname: renderedFname});
        })
        .on('error', function(error) {
            console.log('ERROR reversing gif: ' + error);
            reject(error);
        })
        .output(renderedFname)
        .run();
    })
    .catch(function(ex) {
        console.log(ex);
        throw ex;
    });
}

var gifHandler = function(vidFname, seekPoint, thumbnailSec, parsedFname) {
    return new Promise(function(resolve, reject) {
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
            resolve(reverseGif(renderedFname, parsedFname));
        })
        .on('error', function(error) {
            console.log('ERROR creating gif: ' + error);
            reject(error);
        })
        .output(renderedFname)
        .run();
    })
    .then(function(reverseGifParams) {
        return reverseGifParams;
    })
    .catch(function(ex) { 
        console.log(ex);
        throw ex;
    });
}
