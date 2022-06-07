/* Utility helpers for the Javascript language
*/


exports.promise = {
   /* RESOLVE:  Each function in array called and resolved sequentially
      PURPOSE: Promises are eager and asynchronous which can overload resources they act on.
               e.g. CouchDB if you simultaneously request every document in DB.
      WARNING: Imposes blocking on the JS single threaded non I/O blocking engine!
      SEE:     https://css-tricks.com/why-using-reduce-to-sequentially-resolve-promises-works/
   */
   sequential$: function( functionArray ) {                                                           // Array of functions that return a promise
                   return functionArray.reduce (                                                      // reduce is the looping mechanism upon which we build sequential behavior
                      ( previousPromises,                                                             // Promises resolved to this point
                        nextFunction$ ) =>                                                            // DESIGN: function rather than the eager promise itself to pace execution
                           previousPromises.then (                                                    // Only once promises to this point resolved
                              () => nextFunction$()                                                   // do we call the function that returns the next promise
                           ),                                                                         // Which is then eagerly passed back through resolve
                      Promise.resolve()                                                               // Start with a resolved promise
                   )
                },
   
   /* RESOLVE: Adds a delay in ms to the Callback Queue
   */
   delay$: function( ms ) {
              return new Promise(resolve => setTimeout(resolve, ms))
           }
}

exports.sundry = {
   /* RETURN: a string that contains a timestamp and is a valid fileName
   */
   isoFileName: () => (new Date()).toISOString().replace(/:/g, '_')
}