/**
 *
 */
var seed = {
    socket:  io.connect('http://localhost'),
    /**
     *
     */
    downfiles : {},
    files: {},
    curFile: {},
    /**
     *
     */
    fileApi: {
        /**
         *
         */
        requestFileSystem: window.requestFileSystem || window.webkitRequestFileSystem,
        /**
         *
         */
        requestQuota: function(size){
            if (window.webkitStorageInfo !== 'undefined') //typeof?
                //@todo define requested space in config (size)
                window.webkitStorageInfo.requestQuota(PERSISTENT, 1024*1024*800, function(grantedBytes) {
                    seed.fileApi.requestFileSystem(window.PERSISTENT,grantedBytes, seed.fileApi.onFsInit, fsInitErrorHandler);
                }, function(e) {
                    console.log('Error', e.toString());
                });
            else  {
                alert("Your browser doesn't support file api. Recently chrome is the only supported browser")
            }
        },
        /**
         * File system successfull require callback
         * @param fs FIleSystem variable for working with isolated browser file system
         */
        onFsInit : function(fs){
            fs.root.getFile(arrfile['name'], {create: true}, function(fileEntry) {
                //fileEntry.remove();
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = function(e) {
                        console.log('Partial write.' + chunk + " of " + f.chunks + " chunks completed");
                        if(f.chunks == chunk){
                            console.log("completed");
                            window.location.href = fileEntry.toURL();
                        }
                    };

                    fileWriter.onerror = function(e) {
                        alert('Write failed: ' + e.toString());
                    };

                    //var bb = new BlobBuilder(); deprecated in favor of Blob
                    //var arr = new Array();
                    //arr.push("Lorem Ipsum");
                    //arr.push(" Doloris");
                    //var bb = new Blob([f.data],{type: arrfile['type']} );

                    //var bb = new Blob([f.data],{type: arrfile['type']} );
                    var bb = new Blob([data],{type: arrfile['type']} );
                    //var bb = new Blob([data],{type: 'application/octet-stream'} );
                    fileWriter.seek(fileWriter.length); // Start write position at EOF.
                    fileWriter.write(bb);
                    //saveAs(bb, "test.mp3");
                }, errorHandler);
            }, errorHandler);
        },
        errorHandler : function(e) {
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
            };

            alert('Error: ' + msg);
        },


        fsInitErrorHandler : function (e){
            alert('unsuccessfull init' + e.code);
        }
    },
    callbacks:{
        fileTransfer: function(data){
            $('#fileslist').show();
            $('#clicky').html('');
            $('#clicky').hide();
            $('#fileslist').html('');
            $('#fileslist').html(function(i,v){
                return '<table id="filestable" cellspacing="0" summary=""><tr><th scope="col" abbr="Filename" class="nobg" width="60%">Filename</th><th scope="col" abbr="Status" width="20%" >Size</th> <th scope="col" abbr="Size"width="20%" >Action</th></tr>' + v;
            });

            seed.files = JSON.parse(data);

            for (var file in files) {
                //console.log(files);
                if (seed.files.hasOwnProperty(file)) { //not in prototype!
                    seed.curFile = seed.files[file][3]; //expecting 1 file only
                    /**
                     * Object
                     paul.mp3: Array[4]
                     0: "paul.mp3"
                     1: 5042722
                     2: "audio/mp3"
                     3: Object
                     lastModifiedDate: "2013-02-22T12:31:18.000Z"
                     name: "paul.mp3"
                     size: 5042722
                     type: "audio/mp3"
                     webkitRelativePath: ""
                     */
                    $('#filestable').append('<tr><th scope="row" class="spec">' + files[file][0] + '</th><td>' + files[file][1] + '</td><td class="end" ><div id="fidspan' + fid + '"></div><a href="" onclick="beginTransfer(\'' + files[file][0] + '\', ' + fid + ', ' + files[file][1] + '); return false;" id="fid' + fid + '">Transfer</a><a href="data:' + files[file][2] + ';base64," target="_blank" id="fidsave' + fid + '" style="display:none">Save to disk!</a></td></tr>');
                    fid++;
                };
            }
        },
        /**
         *
         * @param file
         * @param chunk(number)
         */
        beginTransfer : function(file, chunk){  //@todo file is deprecated parameter. Remove it
            if(chunk == 0){
                $('#info').append("Begining Transfer..");
            }

            //fileholder= files[file];
            //fileo= files[file][3]; //ugly

            //@todo debug for start/stop right values
            start = chunk * chunksize;

            if((parseInt(seed.curFile['size']) - 1) <= start + chunksize - 1){
                stop = parseInt(seed.curFile['size']) - 1;
                //start =    (chunk - 1) * chunksize; //added recently         no need when chunks number changed to chunks-1
            }
            else{
                stop = start + chunksize - 1;
            }

            // If we use onloadend, we need to check the readyState.
            reader.onloadend = function(evt) {
                if (evt.target.readyState == FileReader.DONE) { // DONE == 2
                    var data = evt.target.result;
                    //console.log(data);
                    seed.socket.emit('datatransfer', data, seed.curFile['name'], chunk);
                }
            };

            if (seed.curFile.slice) {
                var blob = seed.curFile.slice(start, stop + 1);
            } else if (seed.curFile.mozSlice) {
                var blob = seed.curFile.mozSlice(start, stop + 1);
            }
            else{
                alert("It won't work in your browser. Please use Chrome or Firefox.");
            }

            //reader.readAsDataURL(blob);
            reader.readAsBinaryString(blob);

        },

        datatransfer: function(data, file, chunk){
            console.log("dataTransfer " + " " + chunk);
            f = seed.downfiles[file];

            //data = decode64(data.split(',')[1]);
            //f.data = f.data + data;

            //if webkit
            seed.fileApi.requestQuota();



            //конец загрузки
            if(f.chunks == chunk){
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
                 */





                $(fsave).attr('href', $(fsave).attr('href') + encode64(f.data));
                $('#info').append("Transfer finished!");
            }
            else{
                var fspan = "#fidspan" + f.fid;
                $(fspan).html(Math.floor(((chunk/f.chunks) * 100)) + '%');
                var nextchunk = parseInt(chunk);
                seed.socket.emit('begintransfer', file, nextchunk+1);
            }
        }
    },
    initiators: {
        beginTransfer: function(file, fid, size){

            var f = "#fidspan" + fid;
            $(f).html('0%');
            f = "#fid" + fid;
            $(f).hide();

            var chunks = size/chunksize -1;
            if(chunks% 1 != 0){
                chunks = Math.floor(chunks) + 1;
            }

            seed.downfiles[file] = {data:'', chunk:0, chunks:chunks, fid:fid};
            seed.socket.emit('begintransfer', file, 0);
        },

        handleFileSelect: function(evt) {
            var viles = evt.target.files; // FileList object


            // Loop through the FileList and append files to list.
            for (var i = 0, f; f = viles[i]; i++) {
                if (!seed.files.hasOwnProperty(f)) {
                    seed.files[f.name] = [f.name, f.size, f.type, f];
                };
            }
            seed.socket.emit('listfiles', JSON.stringify(files));

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
