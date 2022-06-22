// node
const fsPromises = require('fs').promises;

// npm
const axios = require('axios');
const PouchDB = require('pouchdb-node');
const tar = require('tar');

// monitor
const env = require('../config.env')();
const logger = require('_helpers/logger');
const coding = require('_helpers/coding');
const couchdb = require('_helpers/couchdb');

const inspect = require('util').inspect;                                                              // https://nodejs.org/en/knowledge/getting-started/how-to-use-util-inspect/ to stringify objects that may contain cirular references

/* RESOLVE: Initial backup was successful. 
   DESIGN: Subsequent backups are setTimout scheduled repeated call, so an async process spawned by this
           entry function, but not chained to it. This avoids stack accumulation.
===================================================================================================== */
module.exports
 = () => {
      logger.INFO("Mounting backup$", { } );
      return engine$()
      .catch( err => logger.ERROR("backup$ failed on first attempt to create backup",
                                  {},
                                  err)
                           .throwLogged()
      )
   }


/* engine$ =============================================================================================
   Perpetual process periodically replicates local couchDB into a pouchdb-node                        */
function engine$() {
   // Generate name of directory that ReplicateCDB instance will be replicated to
   backupName = coding.sundry.isoFileName();
   let backupDir = env.backup.relativeDir + backupName;
   
   return fsPromises.mkdir( backupDir )
   .then( () => replicatedDB$() )
    // Replicate ReplicateCDB to a new PouchDB then tar and compress it's directory
   .then( replicatedDB  => {
             
             // Replicate each DB to new directory
             return coding.promise.sequential$(
                       replicatedDB.map(dbName => () => snapshot$( dbName,
                                                                   backupDir ) )
             )
             // Backup _users DB
             .then( () => replicateUsers$( backupDir )
             )
             //Tar up the directory
             .then( () => tar.create ( { gzip: true,
                                         file: backupDir + '.tgz'
                                       },
                                       [backupDir] )
             )
             // Remove the directory
             .then( () => fsPromises.rm( backupDir, 
                                         { recursive: true } )
             )
          }
    )
    /* Throwing error in the engine cycle will let main app.js know engine did not successfully start */
   .catch( error => logger.ERROR( "backup$.engine$",
                                  {},
                                  error )
                          .throwLogged()
    )
    .then( () => logger.INFO("Succesful backup", { backupName })
    )
    // Scheduled repeated calling avoids stack accumulation, but you lose promise chaining/propagation
   .finally( () => setTimeout( () => engine$()
                                     .catch(error => {
                                               logger.INFO("backup$.engine$.setTimeout consumed", {} )
                                            }),                                                       // Consume any errors as they have been logged and we want backup cycle to continue
                                env.backup.intervalMS )                                               // Interval between backups
    )
}


/* replicatedDB$ =======================================================================================
   RESOLVE: array of DB replicated in local CouchDB                                                   */
function replicatedDB$() {
   return axios.get(
      env.replicate.url + '/_all_dbs',
      { auth: env.replicate.auth.basic
      }
   )
   .then( response => response.data.filter( dbName => ! couchdb.isDesignObject(dbName) ) )
   .catch( error => logger.ERROR( "replicatedDB$ problem retrieving _all_dbs",
                                  {},
                                  error )
                          .throwLogged()
   )
}


/* snapshot$ ============================================================================================
   RESOLVE: provided pouchDB instance has been snapshotted to a pouchdb-node instance                  */
function snapshot$( dbName,
                    backupDir ) {
   
   // snapshot ReplicateDB to levelDB
   return replicate$( dbName,
                      backupDir )
   .catch( err => {
              logger.ERROR("backup.snapshot$ will retry", { dbName,
                                                             backupDir,
                                                             err });
              return coding.promise.delay$(5000)
                     .then( () => replicate$( dbName,
                                              backupDir )
                     )
           }
   )
}


/* replicate$ ==========================================================================================
   RESOLVE: provided pouchDB instance has been snapshotted to a pouchdb-node instance                 */
function replicate$( dbName,
                     backupDir ) {

   // create the pouchDB
   let replicateDB = new PouchDB( env.replicate.url + "/" + dbName,
                                  { auth: env.replicate.auth.basic } );
   let backupDB = new PouchDB( backupDir + "/" + dbName );

   // Replicate down to levelDB
   return replicateDB.replicate.to( backupDB )                                                        // Pouch oneshot replication
   .then( () => {} )                                                                                  // As relicate.to does not return object with finally mathof!?
   // .then( () => traceDB$( backupDB ) )                                                             // Trace out backed up DB. You'll also need to disable deleting of directory once zipped
   .finally( () => {
      Promise.all([
         replicateDB.close().catch( error => logger.ERROR("replicate$ finally replicateDB", { dbName } ) ),
         backupDB.close().catch( error => logger.ERROR("replicate$ finally backupDB", { dbName } ) )
      ])
   })
}



/* replicateUsers$ =====================================================================================
   RESOLVE: _users documents replicated from server to backupDB                                       */
function replicateUsers$( backupDir ) {
   return axios.get(
      env.middleware.url + '/monitor/all_users',
      { auth: env.middleware.auth.basic }
   )
   .then( response => fsPromises.writeFile( backupDir + "/_users.json",
                                           JSON.stringify(response.data,
                                                          null,
                                                          3) )
   )
   .catch( error => logger.ERROR( "replicateUsers$ problem",
                                  {},
                                  error )
                          .throwLogged()
   )
}



/* traceDB$ ============================================================================================
   RESOLVE: writes DB out to a JSON file. 
   USAGE: caller responsible for pouchDB, this method should neither open or close it.
   WARNING: 1. wrote this to check backups working, do not rely on means or structure of traced DB
            2. turn it off once you finished with it                                                  */
function traceDB$( pouchDB ) {
   return pouchDB.allDocs ( { include_docs: true }
   )
   .then( result =>  fsPromises.writeFile( pouchDB.name + ".json",
                                           JSON.stringify(result,
                                                          null,
                                                          3) )
   )
   .catch( error => logger.ERROR( "traceDB$ problem",
                                  {},
                                  error )
                          .throwLogged()
   )
}
