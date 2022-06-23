# focus-monitor
1. maintain synced copy of Focus CouchDB instance
2. regularily snapshot backups to disk

Where possible focus-monitor does things the CouchDB way, synchronising and replicating. This retains document history upon which conflict resolution relies. An identified CouchDB instance is synced to a local CouchDB instance, which is replicated to pouchdb-node levelDB snapshots.

## Monitors
Machines that can, or should be backing up FOCUS.
1. EM0149: This is a primary monitor and needs to be regularly checked. Nick or James.
2. 17-5000: Intermittent monitor. James.

## Setup and update a monitor
### Node + GIT
#### Install
https://nodejs.org latest stable

https://git-scm.com/download/win latest stable

You can substitute your own root directory for c:\focus\focus-monitor
1. $ cd c:\focus
2. $ git clone https://github.com/boyboffin/focus-monitor.git
3. $ cd focus-monitor
4. $ mkdir logs
5. $ mkdir backups
6. $ npm i
7. $ create or copy in a config.env.js and point to server you are backing up e.g.
     - https://focus.emergingminds.com.au/mw
     - https://focus.emergingminds.com.au/db

#### Update
A monitor needs to be manually updated if this app changes.
1. $ cd c:\focus\focus-monitor
2. $ git pull
3. $ npm i
      
### CouchDB
https://www.docker.com/ is preferred way to run a local CouchDB. 

Docker account
1. email: focus@emergingminds.com.au
2. username: emfocus
3. password: Ask James
 
     
#### Install
1. https://hub.docker.com/_/couchdb
2. $ docker run -d -p 5984:5984 --name focus-monitor-couchdb -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=**Ask James** couchdb:3.2.2
3. Finish setting up CouchDB (check this with Nick)
   - $ docker container start focus-monitor-couchdb
   - http://localhost:5984/_utils
     - Login as admin
     - Click setup (spanner left toolbar)
     - Select Single Node. Provide same admin details again, leave rest as is.
   - Verify installation
     - Toolbar button with tick in left column
     - Verify installation button

#### Update
Issue outstanding.
  
## Running monitor
### Start
1. Local CouchDB
   - $ docker container start focus-monitor-couchdb
   - Wait until Docker reports it running
   -  Wait another minute or so if can. While not necessary, this is opportunity to fully synce before first backup runs.
      If you hit it too soon you'll see error messages, but subsequent backup should be fine. Problem is that may be a day away.
2. Monitor node app
   - $ cd c:\focus\focus-monitor
   - $ node ./src/app.js
   - Wait until you see backup successful log
   - check .\backups for a file named <timestamp>.tgz


### Maintain
#### Health check
1. Look for directories in .\backups which will be begun backups that failed and consequently were not tarred and deleted
2. Look at size of successive tgz files, they should be growing as we are not purging CouchDB, and anyway rarely delete anything.
3. Look for successive tgz files datestamped in line with backup schedule specified in config.env.js bearing in mind its not
   running when machine it's installed on is not on.
4. Add a test organisation to the DB and expect to see
   - monitor logs observe and add it to _replicator
   - next backup includes
     -  two new DB, org_xxx and asmt_xxx
     -  The users for the new org appear in _users backup.

#### Inspecting backups
Commented code in backup module allows you to write the pouchdb-node levelDB DB to JSON.
     
### Required actions
#### Deleted DB on PROD
Focus does not provide programatic means of deleting DB, so this should only occur when explicity undertaken by admin.
It does not break the monitor, but there will be ongoing error messages as the local _replicator fails to find the remote DB.
Those messages will report replicator$ state crashing error: db_not_found <name of DB>
Resolve this by manually by removing _replicator document from local CouchDB in one of two following ways:
1. Find the document in _replicator DB and delete it
   - Log into local CouchDB
   - Open the _replicator DB
   - Open Mango query tab and search for document replicating the deleted DB (see example query below)
   - Open the replicator document and delete it
     ```
     {
        "selector": {
           "source.url": {
              "$eq": "https://dev.focus.emergingminds.com.au/db/org_broadcast_bar_f3a5eacf-0"
           }
        }
     }
     ```
2. Find replicator process that has failed and delete document from there
   - In left toolbar click replication button (image shows docs going both left and right)
   - find failed replication task and verify name of DB you know to be deleted
   - click delete replication doc (button picture of bin)
The second approach simpler, but on occasion the replication task list does appear to be complete?

