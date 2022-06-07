// node 
const path = require('path');                                                                         // Node built in path module
const fs = require('fs');
const inspect = require('util').inspect;                                                              // https://nodejs.org/en/knowledge/getting-started/how-to-use-util-inspect/ to stringify objects that may contain cirular references

// env
const env = require('../../config.env')();

// npm
const transporter = env.logging.logToEmail
                    ? require("nodemailer").createTransport(env.smtp)                                 // https://nodemailer.com
                    : undefined;                                                                      // (! logToEmail) == (env.smtp likely invalid) so don't try

// Each log has unique ID within a lifecycle of this node app
var logID = 1;

/* Logger throws an instance of this from throw method.
===================================================================================================== */
exports.LoggedException = LoggedException = function(logID) {
   this.name = "LoggedException";
   this.logID = logID;
};
exports.LoggedException.prototype = Object.create(Error.prototype);


/* logger ==============================================================================================
   DESIGN  Declares a set of log levels in LogType and exports a logging method for each.
   USAGE   Presuming you import this module to variable named logger:
           * logger.ERROR("msg", someObject) will log an error message with those details. 
           * Will be a method of this signature for every LogType.
           * ASSERT a required predicate and log + throw error is not true with logger.assert(...)
===================================================================================================== */


/* logFileStream =======================================================================================
   Node app logs to a file created when app started, that file is named using date stamp
   SEE     https://stackoverflow.com/questions/54541196/append-json-to-a-file-using-node-streams      */
const logFileStream = fs.createWriteStream(                                                           // https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options
   path.join(env.logging.logRootPath,
             (new Date()).toISOString().replace(/:/g, '.')),                                          // https://stackoverflow.com/questions/10610402/javascript-replace-all-commas-in-a-string
   { flags: 'a' }
);


/* Write to log file ===================================================================================
   RESOLVE: Log written to file
   REJECT:  Something went wrong
   This has had no thought at all, will be looking at winston once get amoment.
===================================================================================================== */
function logToFile(str) {
   return new Promise((resolve, reject) => {
      try { logFileStream.write(str +'\r\n'+'\r\n');
            resolve();
      }
      catch (error) { console.log("logToFile failed.", error);
                      reject(error);
      }
   })
}


/* Write to log focus contact email ====================================================================
   RESOLVE: Log emailed if above threshold
===================================================================================================== */
function logToEmail(str) {
     console.log("Email logging disabled while developing");
     Promise.resolve()
   return transporter.sendMail({
     from: env.contact.email,
     to: env.contact.email,
     subject: "Problem in Focus Monitor",
     text: str,
     html: "<div>" + str + ",</div>"
   })
   .catch(error => { console.log("logToEmail failed.", error);
                     reject(error);
   })
}


/* Write to console ====================================================================================
   This has had no thought at all, will be looking at winston once get amoment.
===================================================================================================== */
function logToConsole(str) {
   console.log(str);
}


const LogType = Object.freeze({
    FATAL: Symbol("LOGType.FATAL"),                                       // Middleware should close down at this point.
    ERROR: Symbol("LOGType.ERROR"),                                       // A problem has occured but will continue, possibly by retrying
    WARN:  Symbol("LOGType.WARN"),                                        // Something of concern has transpired that does not in itself jeopardize operations 
    INFO: Symbol("LOGType.INFO"),                                         // Something we'd like a record of
    DEBUG: Symbol("LOGType.DEBUG")                                        // Turn this off for production!
});


/* log ======================================================================================== local ==
   Called by exported LogType functions generated below.
   REVISIT: Promise within a syncronous method!
===================================================================================================== */
function log(logType,                                                     // LogType
             logID,
             msg,                                                         // Every log has a string message
             supporting,                                                  // Any javascript object you like containing supporting data
             caught) {
   try {
      let obj = { date: new Date(),
                  logID,
                  logType,
                  msg,
                  supporting
                };
      if (caught) { Object.assign( obj, {caught} ) };
      let logStr
       = inspect( 
            obj,
            {depth: null}
         );
    
      Promise.all([
         logToFile(logStr),
         logToConsole(logStr),
         env.logging.logToEmail                                                                       // IF Logging to email is enabled
         && [LogType.FATAL, LogType.ERROR , LogType.WARN].includes(logType)                           // AND the log is WARN or higher 
         ? logToEmail(logStr)                                                                         // THEN send log to email endpoint
         : Promise.resolve()                                                                          // ELSE do nothing
      ])
     .catch(err => console.log("Caught log error in promise" + err));
   }
   catch(error) { console.log("Caught log error" + error) }
}


/* Log methods =============================================================================== export ==
   Generate a logging function for each LogType
   RETURN: Convenience object with a throw() method so that users can throw if desired.
   REVISIT: Would be more efficient and useful to have a single declaration for throw function.
            It could then maybe link together propagated error logs.
===================================================================================================== */
Object.keys(LogType).forEach( (key, index) =>                             // FOR each LogType
   exports[key]                                                           // EXPORT a log function
    = function( msg,                                                      // String Message summarizing log
                supporting,                                               // Javascript Object with supporting data. By convention {} if none.
                caught = null ) {
         let thisLogID = logID++;
         log( LogType[key],                                               // Logs at that level
              thisLogID,
              msg,                                                          
              supporting,
              caught );
         return { throwLogged: function() { throw new LoggedException(thisLogID) }}
      }
);

