/**
 * Object representing socket events handlers  and transfered data
 * @type Object
 */
var seed = {

    /**
     * binary data chunk size
     */
    chunksize: 65536,
    /**
     * socket connection object
     */
    //@todo create object config accessible in constructor
    socket:  io.connect('http://localhost'),

    /**
     * Raw binary data chunk transfered from host to pear
     */
    binaryDataChunk: '',

    /**
     * Base64 encoded binary data transfered from host to pear
     * @deprecated
     */
    base64DataChunk: '',

    /**
     * Array of files transfered from host to pear, JSON encoded
     */
    downfiles : {},

    /**
     * Array of transfered files, describing file name, size and type
     */
    files: {},

    /**
     * Array representing currently transfered file
     */
    curFile: {},

    /**
     * Currently transfered chunk number
     * @type Integer
     */
    curChunk: 0,

    /**
     * Number of chunks to be transfered
     * @type Integer
     */
    chunks: 0,

    /**
     * Namespace for file api functions
     * @type Object
     */
    fileApi: {

        /**
         * File system access with file API
         */
        requestFileSystem: window.requestFileSystem || window.webkitRequestFileSystem,

        /**
         * Requests Webkit internal access storage by asking user of lending additional amount of space
         * for browser in user's filesystem&
         * If quota provided callback is called
         */
        requestQuota: function () {

            // we are on webkit
            if (typeof (window.webkitStorageInfo) === 'object') {

                //@todo define requested space in config (size)
                // quota requesting
                window.webkitStorageInfo.requestQuota(PERSISTENT, 1024 * 1024 * 2000,
                    function (grantedBytes) {

                        // accessing internal file system
                        window.webkitRequestFileSystem(window.PERSISTENT, grantedBytes, seed.fileApi.onFsInit, seed.fileApi.fsInitErrorHandler);
                    },
                    function (e) {
                        console.log('Error', e.toString());
                    });
            } else { // we are not on webkit
                console.log("Your browser doesn't support file api. Recently chrome is the only supported browser");
                alert("Your browser doesn't support file api. Recently chrome is the only supported browser");
            }
        },

        /**
         * File system successfull access callback
         * @param fs FileSystem variable for working with isolated browser file system
         * @type Void
         */
        onFsInit : function (fs) {
            fs.root.getFile(seed.curFile.name, {create: true}, function (fileEntry) {
                //@todo remove file if exists. fileEntry.remove();
                fileEntry.createWriter(function (fileWriter) {

                    /**
                     * Handles the file write completed event
                     * @param {Event} e
                     */
                    fileWriter.onwriteend = function (e) {
                        console.log('Partial write.' + seed.curChunk + " of " + seed.chunks + " chunks completed");

                        // if the chunk appended to file was the last to write, redirect to saved file
                        if (seed.chunks === seed.curChunk) {
                            console.log("Write completed");
                            window.location.href = fileEntry.toURL();
                        }
                    };

                    /**
                     * Handles errors/excaptions thrown while writing to file
                     * @param {Event} e
                     */
                    fileWriter.onerror = function (e) {
                        console.log('Write failed: ' + e.toString());
                    };

                    // creating blob from currently transfered binary chunk,
                    // created blob size and chunk raw data size are different
                    // in unknown reason
                    // var bb = new BlobBuilder(); deprecated in favor of Blob
                    var bb = new Blob([seed.binaryDataChunk], {type: seed.curFile.type});

                    // start write position at EOF as we are appending file with new recently transfered chunk
                    fileWriter.seek(fileWriter.length);

                    // append filw with blob data
                    fileWriter.write(bb);
                }, seed.fileApi.errorHandler);
            }, seed.fileApi.errorHandler);
        },

        /**
         * Quota request and file api error handling by it's code
         * @param {Event} e Event object
         * @type Void
         */
        errorHandler : function (e) {
            var msg = '';
            switch (e.code) {
            case FileError.QUOTA_EXCEEDED_ERR:
                msg = 'QUOTA_EXCEEDED_ERR';
                break;
            case FileError.NOT_FOUND_ERR:
                msg = 'NOT_FOUND_ERR';
                break;
            case FileError.SECURITY_ERR:
                msg = 'SECURITY_ERR';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                msg = 'INVALID_MODIFICATION_ERR';
                break;
            case FileError.INVALID_STATE_ERR:
                msg = 'INVALID_STATE_ERR';
                break;
            default:
                msg = 'Unknown Error';
                break;
            }
            console.log('Error: ' + msg);
        },

        /**
         * Error handler for file system initialization api
         * @param {Event} e
         */
        fsInitErrorHandler : function (e) {
            alert('unsuccessfull init' + e.code);
        }
    },
    callbacks: {

        /**
         * Handler for socket 'filereansfer' event
         * Responsible for render of shared files to HTML and saving file info to seed object
         * @param {JSON} data Describes file transfered
         */
        fileTransfer: function (data) {
            $('#fileslist').show();
            $('#clicky').html('');
            $('#clicky').hide();
            $('#fileslist').html('');
            $('#fileslist').html(function (i, v) {
                return '<table id="filestable" cellspacing="0" summary=""><tr><th scope="col" abbr="Filename" class="nobg" width="60%">Filename</th><th scope="col" abbr="Status" width="20%" >Size</th> <th scope="col" abbr="Size"width="20%" >Action</th></tr>' + v;
            });

            //save transfered file dta to seed object
            seed.files = JSON.parse(data);

            // rendering shared files in html
            for (var file in seed.files) {

                //must have 'file' function but not in it's prototype!
                if (seed.files.hasOwnProperty(file)) {
                    seed.curFile = seed.files[file][3]; //expecting 1 file only
                    $('#filestable').append('<tr><th scope="row" class="spec">' + seed.files[file][0] + '</th><td>' + seed.files[file][1] + '</td><td class="end" ><div id="fidspan' + fid + '"></div><a href="" onclick="seed.initiators.beginTransfer(\'' + seed.files[file][0] + '\', ' + fid + ', ' + seed.files[file][1] + '); return false;" id="fid' + fid + '">Transfer</a><a href="data:' + seed.files[file][2] + ';base64," target="_blank" id="fidsave' + fid + '" style="display:none">Save to disk!</a></td></tr>');
                    fid++;
                };
            }
        },

        /**
         * Reads tne next chunk of file unary data and initiates  socket 'datatransfer' event
         * @param {String} file Filename
         * @param {Intereg} chunk  Chunk ready for transporting number
         */
        beginTransfer: function (file, chunk) {
            if (chunk == 0) {
                $('#info').append("Begining Transfer..");
            }

            // Array contails file object within the value of key '3'
            seed.curFile = seed.files[file][3];

            //@todo debug for start/stop right values check
            start = chunk * seed.chunksize;

            if((parseInt(seed.curFile['size']) - 1) <= start + seed.chunksize - 1){
                stop = parseInt(seed.curFile['size']) - 1;
                //start =    (chunk - 1) * seed.chunksize; // added recently. No need when chunks number changed to chunks-1
            }
            else{
                stop = start + seed.chunksize - 1;
            }

            // If we use onloadend, we need to check the readyState
            // as onloaded might be called on read error too.
            reader.onloadend = function (evt) {
                if (evt.target.readyState == FileReader.DONE) { // DONE == 2
                    var data = evt.target.result;
                    seed.socket.emit('datatransfer', data, seed.curFile['name'], chunk);
                }
            };

            if (seed.curFile.slice) {
                var blob = seed.curFile.slice(start, stop + 1);
            } else if (seed.curFile.mozSlice) {
                var blob = seed.curFile.mozSlice(start, stop + 1);
            }
            else {
                alert("It won't work in your browser. Please use Chrome or Firefox.");
            }

            // used for encoding raw binary data to base64. Nedded decoding on receive. Data's not encoded in current implementation.
            // reader.readAsDataURL(blob);

            //reading binary data to send via socket
            reader.readAsBinaryString(blob);
        },

        /**
         *
         * @param {Binary} data Raw binary data received from socket
         * @param {String} file Transfered file name
         * @param {Integer} chunk currently transfered chunk number
         */
        dataTransfer: function (data, file, chunk) {

            // data to be written/appended to file
            seed.binaryDataChunk = data;

            //current chunk number
            seed.curChunk = chunk;

            //total number of chunks to be transfered
            seed.chunks = seed.downfiles[file].chunks
            console.log("dataTransfer " + " " + chunk);

            // decoding from base64 if data sent was read by reader.readAsDataURL(blob)
            // recently data is not ancoded
            // split used to trancate string in the begining of encoded data
            // data = decode64(data.split(',')[1]);
            // f.data = f.data + data;

            // if webkit
            seed.fileApi.requestQuota();

            // last chunk transfered
            if (seed.chunks == seed.curChunk) {
                /*var doc = window.document;
                 var save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a");
                 var click = function(node) {
                 var event = doc.createEvent("MouseEvents");
                 event.initMouseEvent(
                 "click", true, false, window, 0, 0, 0, 0, 0
                 , false, false, false, false, 0, null
                 );
                 return node.dispatchEvent(event); // false if event was cancelled
                 }*/
                var fspan = "#fidspan" + f.fid;
                $(fspan).html('');
                $(fspan).hide();

                var fsave = "#fidsave" + f.fid;
                $(fsave).show();
                /*var  get_URL = function() {
                 return window.URL || window.webkitURL || window;
                 }
                 var blob = new Blob([f.data],{type: "application/octet-stream"} );
                 //alert(f.data.length + " " + blob.size);
                 var get_object_url = function() {
                 var object_url = get_URL().createObjectURL(blob);
                 //deletion_queue.push(object_url);
                 return object_url;
                 }*/
                //object_url = get_object_url(blob);

                /*save_link.href = object_url;
                 save_link.download = 'tasty.mp3';
                 if (click(save_link)) {

                 return;
                 }
                 $(fsave).attr('href', $(fsave).attr('href') + encode64(f.data));
                 */


                $('#info').append("Transfer finished!");
            } else { // continue transfering
                var fspan = "#fidspan" + seed.downfiles[file].fid;
                $(fspan).html(Math.floor(((chunk/seed.chunks) * 100)) + '%');
                var nextchunk = parseInt(seed.curChunk);

                // initiating socket 'begintransfer' event
                seed.socket.emit('begintransfer', file, nextchunk+1);
            }
        }
    },
    initiators: {
        /**
         * Initiates begintransfer socket event and prepares data for it.
         * @param {String} file Filename
         * @param fid Element id
         * @param {Integer} size File size in bytes
         */
        beginTransfer: function (file, fid, size) {
            var f = "#fidspan" + fid;
            $(f).html('0%');
            f = "#fid" + fid;
            $(f).hide();

            var chunks = size/seed.chunksize -1;
            if(chunks% 1 != 0){
                chunks = Math.floor(chunks) + 1;
            }

            seed.downfiles[file] = {data:'', chunk:0, chunks:chunks, fid:fid};
            seed.socket.emit('begintransfer', file, 0);
        },
        /**
         * Handles input event
         * @param {Event} evt
         */
        handleFileSelect: function (evt) {

            // FileList object
            var viles = evt.target.files;

            // Loop through the FileList and append files to list.
            for (var i = 0, f; f = viles[i]; i++) {
                if (!seed.files.hasOwnProperty(f)) {
                    seed.files[f.name] = [f.name, f.size, f.type, f];
                };
            }

            // Initiate socket 'listfiles' event
            seed.socket.emit('listfiles', JSON.stringify(seed.files));

            $('#fileslist').show();
            $('#clicky').html('');
            $('#clicky').hide();
            $('#fileslist').html('');
            $('#fileslist').html(function(i,v){
                return '<table id="filestable" cellspacing="0" summary=""><tr><th scope="col" abbr="Filename" class="nobg" width="60%">Filename</th><th scope="col" abbr="Status" width="20%" >Size</th> <th scope="col" abbr="Size"width="20%" >Action</th></tr>' + v;
            });
            for (var file in seed.files) {
                if (seed.files.hasOwnProperty(file)) {
                    $('#filestable').append('<tr><th scope="row" class="spec">' + seed.files[file][0] + '</th><td>' + seed.files[file][1] + '</td><td class="end"><b>Sharing!</b></td></tr>');
                }
            }
        }
    }
}

/**
 * chars allowed in base64 encoded data
 */
var keyStr = "ABCDEFGHIJKLMNOP" +
    "QRSTUVWXYZabcdef" +
    "ghijklmnopqrstuv" +
    "wxyz0123456789+/" +
    "=";
/**
 *
 * @param {Binary} input Raw binary data
 * @return {String} base64 encoded data
 */
function encode64(input) {
    var output = "";
    var chr1, chr2, chr3 = "";
    var enc1, enc2, enc3, enc4 = "";
    var i = 0;

    do {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
            keyStr.charAt(enc1) +
            keyStr.charAt(enc2) +
            keyStr.charAt(enc3) +
            keyStr.charAt(enc4);
        chr1 = chr2 = chr3 = "";
        enc1 = enc2 = enc3 = enc4 = "";
    } while (i < input.length);

    return output;
}

/**
 *
 * @param input Base64 encoded data
 * Before decoding all the characters before "," must be trancated, if present
 * @return {String} Binary String
 */
function decode64(input) {
    var output = "";
    var chr1, chr2, chr3 = "";
    var enc1, enc2, enc3, enc4 = "";
    var i = 0;

    // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
    var base64test = /[^A-Za-z0-9\+\/\=]/g;
    if (base64test.exec(input)) {
        alert("There were invalid base64 characters in the input text.\n" +
            "Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='\n" +
            "Expect errors in decoding.");
    }
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }

        chr1 = chr2 = chr3 = "";
        enc1 = enc2 = enc3 = enc4 = "";

    } while (i < input.length);

    return unescape(output);
}

var socket = seed.socket;

socket.on('connect', function (data) {
    socket.emit('joiner', $.url().segment(1));
});

socket.on('fileslist', seed.callbacks.fileTransfer);

socket.on('warn', function (data) {
    $('#warnings').html(data);
});

socket.on('host', function (data) {
    if (canHost) {
        $('#host').html("You're hosting this party!");
        $('#clicky').html("<br /><br /><br /><br />Click here to choose files");
        $('#fileslist').hide();
    }
});

socket.on('peer', function (data) {
    $('#peer').html("You're connected as a peer!");
    $('#host').html("Host connected.");
    $('#drop_zone').attr("onclick", function() {
        return;
    });
    $('#files').remove();
    $('#drop_zone').css("cursor", "default");
    $('#fileslist').hide();
    $('#clicky').html('Awaiting file list..');

});

socket.on('peerconnected', function (data) {
    $('#peer').html("Peer connected!");
});

socket.on('peerdisconnected', function (data) {
    $('#peer').html("Peer disconnected.");
});

socket.on('hostdisconnected', function (data) {
    $('#host').html("Host disconnected.");
    $('#peer').html("You're disconnected!");
});

socket.on('info', function (data) {
    $('#info').append(data);
});

socket.on('begintransfer', seed.callbacks.beginTransfer);

socket.on('datatransfer', seed.callbacks.dataTransfer);