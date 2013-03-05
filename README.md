
# P2P file transfer service for testing purposes
Based on DirtyShare by gun.io
Now only supports Chrome due to using file api for saving file
Using Blob object results in wrong file size writen to file system, so resulting file seems to be always broken.
Only for P2P testing purposes

##Reasons not to use file api
FileWriter requires Blob to write to FS.
No way to delete saved files from browser isolated FS as we don't whether user have already downloaded file to his FS after getting link
Next step is to use Stream on node-side.
