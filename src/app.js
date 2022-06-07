/* Combines with CouchDB container on Docker to:
   1. Backing up Focus DB using replication
   2. Perform integrity checks on those DB (TODO)
*/
require('app-module-path').addPath(__dirname);                                                        // support absolute require paths https://github.com/patrick-steele-idem/app-module-path-node


// monitor
const env = require('../config.env')();
const logger = require('_helpers/logger');
const replicator$ = require('./replicator$');
const backup$ = require('./backup$');

// Start the monitor ===================================================================================
( () => {
      logger.INFO( "Mounting monitor", { middleware: env.middleware.url,
                                         focus: env.focus.url,
                                         replicate: env.replicate.url,
                                         backup: env.backup.relativeDir
                                       } );
      // Promise to start things up.
      Promise.all([
         replicator$(),
         backup$()
      ])
      // Exit with error if either process fails on first cycle of respective engines.
      .catch( error => {
                 logger.FATAL("Monitor failed to start",
                              {},
                              error );
                 process.exit(1);
              }
      )
  }
)();
