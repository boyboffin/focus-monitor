# focus-monitor
1. maintain synced copy of Focus CouchDB instance
2. regularily snapshot backups to disk

Backing up CouchDB using it's replication abilities is the correct approach. This gets you the history of documents and when you restore 
from the backup (also using replication) you'll end up with the original DB. That is important as couchDB resolves conflicts by 
looking at the history, so restoring a DB by say creating a new one and dropping in the current document will result in a server that 
is less authoratative than any other DB syncing back to it. Probably not what you want. So this solution utilizes a local CouchDB instance.

While we could snapshot the DB files of our local CouchDB instance, I have instead opted for one off replications to a pouchdb-node
which creates a directory for each DB. We then zip up those directories. This way we are relying on couchdb/pouchdb technology all
the way, and are bouncing down to a static replication before zipping it up. It also means that extracting JSON documents from a backup
can be dome via pouchdb-node rather than invoking a CouchDB instance. This is not directly supported yet, see backup.traceDB$ for some guidance.

## Monitors
Machines that can, or should be backing up FOCUS.
1. EM0035: This is a primary monitor and needs to be regularly checked. Nick or James.
2. 17-5000: Intermittent monitor. James.
3. TODO: Nick. A cloud monitor. A small AWS lightsail may be the go, or a couple of containers.

## Setup and update a monitor
### Node
#### Install
https://nodejs.org latest stable.

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
     - TODO: James provide schema and example config.env.js

#### Update
A monitor needs to be manually updated if this app changes.
1. $ cd c:\focus\focus-monitor
2. $ git pull
3. $ npm i
      
### CouchDB
https://www.docker.com/ is preferred way to run a local CouchDB. 
TODO: Docker crashes on startup 90% of time. I have had success if
I first stop the Docker Desktop Service in Component Services and the start Docker Desktop from desktop icon.

Docker account
1. email: focus@emergingminds.com.au
2. username: emfocus
3. password: Ask James
 
     
#### Install
1. https://hub.docker.com/_/couchdb
2. $ docker run -d -p 5984:5984 --name focus-monitor-couchdb -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=<Ask James> couchdb:3.2.2
3. create these three system db manually from within fauxton: [_global_changes, _users, _replicator]

- $ docker container start focus-monitor-couchdb
- http://localhost:5984/_utils

#### Update
TODO: Work this out. Remember that the monitor will work with any new DB, so maybe the simplest and safest update is to spin up a new image
and point monitor at it, then delete old image. This will pull down entire CouchDB instance from server. A neat alternative would be to
first replicate from the old one, then hook into the new one. That's be super cool.
  
## Running monitor
### Start
1. Local CouchDB
   - $ docker container start focus-monitor-couchdb
   - Wait until Docker reports it running
   -  Wait another minute or so if can. While not necessary, this is opportunity to fully synce before first backup runs.
      If you hit it too soon you'll see error messages, but subsequent backup should be fine. Problem is that may be a day away.
      TODO: write up how to check status of _replicators, or even better poll for it and let user know!
2. Monitor node app
   - $ cd c:\focus\focus-monitor
   - $ node ./src/pp.js
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


### Required actions
#### Deleted DB on PROD
Focus does not provide programatic means of deleting DB, so this should only occur when explicity undertaken by admin.
It does not break the monitor, but there will be ongoing error messages as the local _replicator fails to find the remote DB.
Resolve this by manually removing _replicator document from local CouchDB, and this needs to be done for each monitor.
1. Log into local CouchDB
2. Open the _replicator DB
3. Open MAngo query tab and search for document replicating the deleted DB (see example query below)
```
{
   "selector": {
      "source.url": {
         "$eq": "https://dev.focus.emergingminds.com.au/db/org_broadcast_bar_f3a5eacf-091e-4736-a80b-374fc5731fad"
      }
   }
}
```


## Known issues
   1. Docker not starting, this is serious
   2. When first fired up monitor, it did not create backup directory for first snalshot, instead erroring out.
      Only seen this issue on this machine.
      Consider creating backup directory before starting to backup.

