// npm
const axios = require('axios');

// monitor
const env = require('../config.env')();
const logger = require('_helpers/logger');
const couchdb = require('_helpers/couchdb');

// State variable so that we can log INFO when polling sucessfully resumes
let mostRecentPollSuceeded = true;


/* RESOLVE: Initial replication was successful. 
   DESIGN: Subsequent relications are setTimout scheduled repeated call, an async process spawned by
           this entry function, but not chained to it. This avoids stack accumulation.
===================================================================================================== */
module.exports
 = () => {
      logger.INFO("Mounting replicator$", { } );
      return pollForNewDB$()
      .catch( err => logger.ERROR( "replicator$ failed on first attempt to pollForNewDB$",
                                   {},
                                   err )
                           .throwLogged()
      )
   }


/* RESOLVE: Discovers and registers new DB on the server and begins replicating them.
   DESIGN:  ReplicatorCDB has a _replicator for every FocusCDB application DB. 
===================================================================================================== */
function pollForNewDB$() {
   return Promise.all([
      focusDB$(),
      replicating$()
   ])
   .then( ([ focusDB,
             replicating ]) => 
                Promise.all (
                   focusDB.map( dbName => {
                                   let replicator = replicating.find( scheduler => scheduler.source.slice(env.focus.url.length + 1).slice(0, -1) == dbName );
                                   return replicator
                                   ? Promise.resolve()
                                   : postReplicator$(dbName)
                                }
                   )
                )
   )
    /* Throwing error in the engine cycle will let main app.js know did not successfully start */
   .catch( error => { mostRecentPollSuceeded = false;
                      logger.ERROR( "replicator$.pollForNewDB$",
                                    {},
                                    error )
                            .throwLogged();
                    }
    )
    // Logger INFO if recovering from earlier error
    .then(() => {
             if (! mostRecentPollSuceeded) {
                logger.INFO("replicator$.pollForNewDB$ recovered", {});
                mostRecentPollSuceeded = true;
             }
          }
    )
    // Scheduled repeated calling avoids stack accumulation, but you lose promise chaining/propagation
   .finally( () => setTimeout( () => pollForNewDB$()
                                     .catch(error => {
                                               logger.INFO("replicator$.pollForNewDB$.setTimeout consumed", {} )
                                            }),                                                       // Consume any errors as they have been logged and we want backup cycle to continue
                                env.replicate.pollIntervalMS )                                        // Polling interval
    )
}


/* RESOLVE: array of DB names in Focus CouchDB
===================================================================================================== */
function focusDB$() {
   return axios.get(
      env.middleware.url + '/monitor/all_dbs',
      { auth: env.middleware.auth.basic }
   )
   .then( response => response.data.filter( dbName => ! couchdb.isDesignObject(dbName) )
   )
   .catch( error => logger.ERROR( "focusDB$",
                                  {},
                                  error )
                          .throwLogged()
   )
}


/* RESOLVE: array of _replicator documents in replicateDB
===================================================================================================== */
function replicating$() {
   return axios.get(
      env.replicate.url + '/_replicator/_all_docs',
      { auth: env.replicate.auth.basic,
        params: { include_docs: true }
      }
   )
   .then( response => 
             Promise.all(
                response.data.rows
                .map( row => row.doc )
                .filter( doc => ! couchdb.isDesignObject(doc._id) )
                .map( replicator =>
                   axios.get( env.replicate.url + '/_scheduler/docs/_replicator/' + replicator._id,
                              { auth: env.replicate.auth.basic }
                   )
                   .then( response => {
                             if (response.data.state != 'running')
                               logger.WARN("FocusDB replicator found in non running state",
                                           { method: "replicating$",
                                             response: response.data,
                                             state: response.data.state });
                             return response.data;
                          }
                   )
                   .catch( e => { throw e } )
                )
             )
   )
   .catch( error => logger.ERROR("replicating$", { error: error.toString()})
                          .throwLogged()
   )
}


/* RESOLVE: replicateDB has a _replicator document for named DB in Focus CouchDB
===================================================================================================== */
function postReplicator$(dbName) {
   return axios ({
      method: 'post',
      auth: env.replicate.auth.basic,
      url: env.replicate.url + '/_replicator',
      data: {
         "source": {
            "url": env.focus.url + "/" + dbName,
            "auth": env.focus.auth
         },
         "target": {
            "url": env.replicate.url + "/" + dbName,
            "auth": env.replicate.auth
         },
         "create_target": true,
         "continuous": true
      }
   })
   .then( response => logger.INFO(dbName + " _replicator created", {response: response.toString()})
   )
   .catch( error => logger.ERROR("postReplicator$", { error: error.toString()})
                          .throwLogged()
   )
}
