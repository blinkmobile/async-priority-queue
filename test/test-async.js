var async = require('../lib/async');

if (!Function.prototype.bind) {
    Function.prototype.bind = function (thisArg) {
        var args = Array.prototype.slice.call(arguments, 1);
        var self = this;
        return function () {
            self.apply(thisArg, args.concat(Array.prototype.slice.call(arguments)));
        }
    };
}

function eachIterator(args, x, callback) {
    setTimeout(function(){
        args.push(x);
        callback();
    }, x*25);
}

function mapIterator(call_order, x, callback) {
    setTimeout(function(){
        call_order.push(x);
        callback(null, x*2);
    }, x*25);
}

function filterIterator(x, callback) {
    setTimeout(function(){
        callback(x % 2);
    }, x*25);
}

function detectIterator(call_order, x, callback) {
    setTimeout(function(){
        call_order.push(x);
        callback(x == 2);
    }, x*25);
}

function eachNoCallbackIterator(test, x, callback) {
    test.equal(x, 1);
    callback();
    test.done();
}

function getFunctionsObject(call_order) {
    return {
        one: function(callback){
            setTimeout(function(){
                call_order.push(1);
                callback(null, 1);
            }, 125);
        },
        two: function(callback){
            setTimeout(function(){
                call_order.push(2);
                callback(null, 2);
            }, 200);
        },
        three: function(callback){
            setTimeout(function(){
                call_order.push(3);
                callback(null, 3,3);
            }, 50);
        }
    };
}

exports['nextTick'] = function(test){
    var call_order = [];
    async.nextTick(function(){call_order.push('two');});
    call_order.push('one');
    setTimeout(function(){
        test.same(call_order, ['one','two']);
        test.done();
    }, 50);
};

exports['nextTick in the browser'] = function(test){
    if (typeof process !== 'undefined') {
        // skip this test in node
        return test.done();
    }
    test.expect(1);

    var call_order = [];
    async.nextTick(function(){call_order.push('two');});

    call_order.push('one');
    setTimeout(function(){
        if (typeof process !== 'undefined') {
            process.nextTick = _nextTick;
        }
        test.same(call_order, ['one','two']);
    }, 50);
    setTimeout(test.done, 100);
};

exports['noConflict - node only'] = function(test){
    if (typeof process !== 'undefined') {
        // node only test
        test.expect(3);
        var fs = require('fs');
        var vm = require('vm');
        var filename = __dirname + '/../lib/async.js';
        fs.readFile(filename, function(err, content){
            if(err) return test.done();

            var s = vm.createScript(content, filename);
            var s2 = vm.createScript(
                content + 'this.async2 = this.async.noConflict();',
                filename
            );

            var sandbox1 = {async: 'oldvalue'};
            s.runInNewContext(sandbox1);
            test.ok(sandbox1.async);

            var sandbox2 = {async: 'oldvalue'};
            s2.runInNewContext(sandbox2);
            test.equals(sandbox2.async, 'oldvalue');
            test.ok(sandbox2.async2);

            test.done();
        });
    }
    else test.done();
};

exports['queue'] = function (test) {
    var call_order = [],
        delays = [160,80,240,80];

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', 'arg');
        }, delays.splice(0,1)[0]);
    }, 2);

    q.push(1, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 1);
        call_order.push('callback ' + 1);
    });
    q.push(2, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 2);
        call_order.push('callback ' + 2);
    });
    q.push(3, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 3);
    });
    q.push(4, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 4);
    });
    test.equal(q.length(), 4);
    test.equal(q.concurrency, 2);

    q.drain = function () {
        test.same(call_order, [
            'process 2', 'callback 2',
            'process 1', 'callback 1',
            'process 4', 'callback 4',
            'process 3', 'callback 3'
        ]);
        test.equal(q.concurrency, 2);
        test.equal(q.length(), 0);
        test.done();
    };
};

exports['queue default concurrency'] = function (test) {
    var call_order = [],
        delays = [160,80,240,80];

    // order of completion: 1,2,3,4

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', 'arg');
        }, delays.splice(0,1)[0]);
    });

    q.push(1, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 3);
        call_order.push('callback ' + 1);
    });
    q.push(2, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 2);
        call_order.push('callback ' + 2);
    });
    q.push(3, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 1);
        call_order.push('callback ' + 3);
    });
    q.push(4, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 4);
    });
    test.equal(q.length(), 4);
    test.equal(q.concurrency, 1);

    q.drain = function () {
        test.same(call_order, [
            'process 1', 'callback 1',
            'process 2', 'callback 2',
            'process 3', 'callback 3',
            'process 4', 'callback 4'
        ]);
        test.equal(q.concurrency, 1);
        test.equal(q.length(), 0);
        test.done();
    };
};

exports['queue error propagation'] = function(test){
    var results = [];

    var q = async.queue(function (task, callback) {
        callback(task.name === 'foo' ? new Error('fooError') : null);
    }, 2);

    q.drain = function() {
        test.deepEqual(results, ['bar', 'fooError']);
        test.done();
    };

    q.push({name: 'bar'}, function (err) {
        if(err) {
            results.push('barError');
            return;
        }

        results.push('bar');
    });

    q.push({name: 'foo'}, function (err) {
        if(err) {
            results.push('fooError');
            return;
        }

        results.push('foo');
    });
};

exports['queue changing concurrency'] = function (test) {
    var call_order = [],
        delays = [40,20,60,20];

    // worker1: --1-2---3-4
    // order of completion: 1,2,3,4

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', 'arg');
        }, delays.splice(0,1)[0]);
    }, 2);

    q.push(1, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 3);
        call_order.push('callback ' + 1);
    });
    q.push(2, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 2);
        call_order.push('callback ' + 2);
    });
    q.push(3, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 1);
        call_order.push('callback ' + 3);
    });
    q.push(4, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 4);
    });
    test.equal(q.length(), 4);
    test.equal(q.concurrency, 2);
    q.concurrency = 1;

    setTimeout(function () {
        test.same(call_order, [
            'process 1', 'callback 1',
            'process 2', 'callback 2',
            'process 3', 'callback 3',
            'process 4', 'callback 4'
        ]);
        test.equal(q.concurrency, 1);
        test.equal(q.length(), 0);
        test.done();
    }, 250);
};

exports['queue push without callback'] = function (test) {
    var call_order = [],
        delays = [160,80,240,80];

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', 'arg');
        }, delays.splice(0,1)[0]);
    }, 2);

    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4);

    setTimeout(function () {
        test.same(call_order, [
            'process 2',
            'process 1',
            'process 4',
            'process 3'
        ]);
        test.done();
    }, 800);
};

exports['queue unshift'] = function (test) {
    var queue_order = [];

    var q = async.queue(function (task, callback) {
      queue_order.push(task);
      callback();
    }, 1);

    q.unshift(4);
    q.unshift(3);
    q.unshift(2);
    q.unshift(1);

    setTimeout(function () {
        test.same(queue_order, [ 1, 2, 3, 4 ]);
        test.done();
    }, 100);
};

exports['queue too many callbacks'] = function (test) {
    var q = async.queue(function (task, callback) {
        callback();
        test.throws(function() {
            callback();
        });
        test.done();
    }, 2);

    q.push(1);
};

exports['queue bulk task'] = function (test) {
    var call_order = [],
        delays = [160,80,240,80];

    // worker1: --1-4
    // worker2: -2---3
    // order of completion: 2,1,4,3

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', task);
        }, delays.splice(0,1)[0]);
    }, 2);

    q.push( [1,2,3,4], function (err, arg) {
        test.equal(err, 'error');
        call_order.push('callback ' + arg);
    });

    test.equal(q.length(), 4);
    test.equal(q.concurrency, 2);

    setTimeout(function () {
        test.same(call_order, [
            'process 2', 'callback 2',
            'process 1', 'callback 1',
            'process 4', 'callback 4',
            'process 3', 'callback 3'
        ]);
        test.equal(q.concurrency, 2);
        test.equal(q.length(), 0);
        test.done();
    }, 800);
};

exports['queue idle'] = function(test) {
    var q = async.queue(function (task, callback) {
      // Queue is busy when workers are running
      test.equal(q.idle(), false)
      callback();
    }, 1);

    // Queue is idle before anything added
    test.equal(q.idle(), true)

    q.unshift(4);
    q.unshift(3);
    q.unshift(2);
    q.unshift(1);

    // Queue is busy when tasks added
    test.equal(q.idle(), false)

    q.drain = function() {
        // Queue is idle after drain
        test.equal(q.idle(), true);
        test.done();
    }
}

exports['queue pause'] = function(test) {
    var call_order = [],
        task_timeout = 100,
        pause_timeout = 300,
        resume_timeout = 500,
        tasks = [ 1, 2, 3, 4, 5, 6 ],

        elapsed = (function () {
            var start = (new Date()).valueOf();
            return function () {
              return Math.round(((new Date()).valueOf() - start) / 100) * 100;
            };
        })();

    var q = async.queue(function (task, callback) {
        call_order.push('process ' + task);
        call_order.push('timeout ' + elapsed());
        callback();
    });

    function pushTask () {
        var task = tasks.shift();
        if (!task) { return; }
        setTimeout(function () {
            q.push(task);
            pushTask();
        }, task_timeout);
    }
    pushTask();

    setTimeout(function () {
        q.pause();
        test.equal(q.paused, true);
    }, pause_timeout);

    setTimeout(function () {
        q.resume();
        test.equal(q.paused, false);
    }, resume_timeout);

    setTimeout(function () {
        test.same(call_order, [
            'process 1', 'timeout 100',
            'process 2', 'timeout 200',
            'process 3', 'timeout 500',
            'process 4', 'timeout 500',
            'process 5', 'timeout 500',
            'process 6', 'timeout 600'
        ]);
        test.done();
    }, 800);
}

exports['queue pause with concurrency'] = function(test) {
    var call_order = [],
        task_timeout = 100,
        pause_timeout = 50,
        resume_timeout = 300,
        tasks = [ 1, 2, 3, 4, 5, 6 ],

        elapsed = (function () {
            var start = (new Date()).valueOf();
            return function () {
              return Math.round(((new Date()).valueOf() - start) / 100) * 100;
            };
        })();

    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            call_order.push('timeout ' + elapsed());
            callback();
        }, task_timeout);
    }, 2);

    q.push(tasks);

    setTimeout(function () {
        q.pause();
        test.equal(q.paused, true);
    }, pause_timeout);

    setTimeout(function () {
        q.resume();
        test.equal(q.paused, false);
    }, resume_timeout);

    setTimeout(function () {
        test.same(call_order, [
            'process 1', 'timeout 100',
            'process 2', 'timeout 100',
            'process 3', 'timeout 400',
            'process 4', 'timeout 400',
            'process 5', 'timeout 500',
            'process 6', 'timeout 500'
        ]);
        test.done();
    }, 800);
}

exports['queue kill'] = function (test) {
    var q = async.queue(function (task, callback) {
        setTimeout(function () {
            test.ok(false, "Function should never be called");
            callback();
        }, 300);
    }, 1);
    q.drain = function() {
        test.ok(false, "Function should never be called");
    }

    q.push(0);

    q.kill();

    setTimeout(function() {
      test.equal(q.length(), 0);
      test.done();
    }, 600)
};

exports['priorityQueue'] = function (test) {
    var call_order = [];

    // order of completion: 2,1,4,3

    var q = async.priorityQueue(function (task, callback) {
      call_order.push('process ' + task);
      callback('error', 'arg');
    }, 1);

    q.push(1, 1.4, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 2);
        call_order.push('callback ' + 1);
    });
    q.push(2, 0.2, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 3);
        call_order.push('callback ' + 2);
    });
    q.push(3, 3.8, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 3);
    });
    q.push(4, 2.9, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 1);
        call_order.push('callback ' + 4);
    });
    test.equal(q.length(), 4);
    test.equal(q.concurrency, 1);

    q.drain = function () {
        test.same(call_order, [
            'process 2', 'callback 2',
            'process 1', 'callback 1',
            'process 4', 'callback 4',
            'process 3', 'callback 3'
        ]);
        test.equal(q.concurrency, 1);
        test.equal(q.length(), 0);
        test.done();
    };
};

exports['priorityQueue concurrency'] = function (test) {
    var call_order = [],
        delays = [160,80,240,80];

    // worker1: --2-3
    // worker2: -1---4
    // order of completion: 1,2,3,4

    var q = async.priorityQueue(function (task, callback) {
        setTimeout(function () {
            call_order.push('process ' + task);
            callback('error', 'arg');
        }, delays.splice(0,1)[0]);
    }, 2);

    q.push(1, 1.4, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 2);
        call_order.push('callback ' + 1);
    });
    q.push(2, 0.2, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 1);
        call_order.push('callback ' + 2);
    });
    q.push(3, 3.8, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 3);
    });
    q.push(4, 2.9, function (err, arg) {
        test.equal(err, 'error');
        test.equal(arg, 'arg');
        test.equal(q.length(), 0);
        call_order.push('callback ' + 4);
    });
    test.equal(q.length(), 4);
    test.equal(q.concurrency, 2);

    q.drain = function () {
        test.same(call_order, [
            'process 1', 'callback 1',
            'process 2', 'callback 2',
            'process 3', 'callback 3',
            'process 4', 'callback 4'
        ]);
        test.equal(q.concurrency, 2);
        test.equal(q.length(), 0);
        test.done();
    };
};

exports['queue events'] = function(test) {
    var calls = [];
    var q = async.queue(function(task, cb) {
        // nop
        calls.push('process ' + task);
        async.setImmediate(cb);
    }, 10);
    q.concurrency = 3;

    q.saturated = function() {
        test.ok(q.length() == 3, 'queue should be saturated now');
        calls.push('saturated');
    };
    q.empty = function() {
        test.ok(q.length() == 0, 'queue should be empty now');
        calls.push('empty');
    };
    q.drain = function() {
        test.ok(
            q.length() == 0 && q.running() == 0,
            'queue should be empty now and no more workers should be running'
        );
        calls.push('drain');
        test.same(calls, [
            'saturated',
            'process foo',
            'process bar',
            'process zoo',
            'foo cb',
            'process poo',
            'bar cb',
            'empty',
            'process moo',
            'zoo cb',
            'poo cb',
            'moo cb',
            'drain'
        ]);
        test.done();
    };
    q.push('foo', function () {calls.push('foo cb');});
    q.push('bar', function () {calls.push('bar cb');});
    q.push('zoo', function () {calls.push('zoo cb');});
    q.push('poo', function () {calls.push('poo cb');});
    q.push('moo', function () {calls.push('moo cb');});
};

exports['queue empty'] = function(test) {
    var calls = [];
    var q = async.queue(function(task, cb) {
        // nop
        calls.push('process ' + task);
        async.setImmediate(cb);
    }, 3);

    q.drain = function() {
        test.ok(
            q.length() == 0 && q.running() == 0,
            'queue should be empty now and no more workers should be running'
        );
        calls.push('drain');
        test.same(calls, [
            'drain'
        ]);
        test.done();
    };
    q.push([]);
};

exports['queue started'] = function(test) {

  var calls = [];
  var q = async.queue(function(task, cb) {});

  test.equal(q.started, false);
  q.push([]);
  test.equal(q.started, true);
  test.done();

};
