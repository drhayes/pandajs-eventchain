/* jshint -W097 */
/* global require, global, describe, beforeEach, it, */

'use strict';

var assert = require('assert');

// Fake the Panda global namespace with good enough definitions.
var game = global.game = {
  // Properties used by eventChain.
  system: {
    tick: 0
  },
  // Panda module definition stuff.
  module: function() {
    return this;
  },

  body: function(definition) {
    definition();
  }
};

require('../eventChain.js');
var eventChain = game.EventChain;

describe('eventChain', function() {
  var chain;

  beforeEach(function() {
    // Reset game namespace state.
    game.system.delta = 0;
    // Instantiate a new chain.
    chain = eventChain();
  });

  it('defines some functions', function() {
    var operators = ['then', 'thenUntil', 'wait', 'during', 'repeat', 'every'];
    operators.forEach(function(operator) {
      assert(chain[operator]);
    });
  });

  it('is itself a function', function() {
    assert(typeof chain === 'function');
  });

  it('has a then function that executes every invocation', function() {
    var counter = 0;
    chain
      .then(function() {
        counter += 1;
      })
      .then(function() {
        counter += 1;
      });
      // Now invoke it four times.
    chain();
    chain();
    chain();
    chain();
    assert(counter === 2);
  });

  it('has a waitUntil function that waits until the predicate ' +
      'returns true', function(){
    var counterA = 0;
    var counterB = 0;

    chain
      .waitUntil( function(){ return counterA > 0; } )
      .then( function(){ counterB = 1; });

    assert( counterA === 0 );
    chain();
    assert( counterA === 0 );
    counterA = 1;
    chain();
    assert( counterB === 1 );
  });

  it('has a thenUntil function that executes while ' +
      '"until" predicate is false', function(){
    var counterA = 0;
    var counterB = 0;
    var counterC = 0;

    chain
      .thenUntil( function(){ counterA += 1; },
                  function(){ return counterA === 3; } )
      .then( function(){
        counterB = 10;
      })
      .then( function(){
        counterA = -1;
        counterB = -2;
      }).thenUntil( function(){ counterC += 2; },
                    function(){ return counterC === 6; } ).
      then( function(){
        counterA = 100;
        counterB = 200;
        counterC = 300;
      });


    assert( counterA === 0 );
    assert( counterB === 0 );
    assert( counterC === 0 );

    chain();
    assert( counterA === 1 );
    assert( counterB === 0 );
    assert( counterC === 0 );

    chain();
    assert( counterA === 2 );
    assert( counterB === 0 );
    assert( counterC === 0 );

    chain();
    assert( counterA === 3 );
    assert( counterB === 10 );
    assert( counterC === 0 );

    chain();
    assert( counterA === -1 );
    assert( counterB === -2 );
    assert( counterC === 0 );

    chain();
    assert( counterA === -1 );
    assert( counterB === -2 );
    assert( counterC === 2 );

    chain();
    assert( counterA === -1 );
    assert( counterB === -2 );
    assert( counterC === 4 );

    chain();
    assert( counterA === 100 );
    assert( counterB === 200 );
    assert( counterC === 300 );
  });

  it('can wait before executing', function() {
    var done = false;
    chain
      .wait(2)
      .then(function() {
        done = true;
      });
    // Now invoke the chain while game.system.tick is 0.
    chain();
    chain();
    chain();
    chain();
    assert(!done);
    // Now set our tick to 5.
    game.system.tick = 5;
    chain();
    chain();
    assert(done);
  });

  it('can do stuff during a wait', function() {
    var duringCounter = 0;
    var done = false;
    chain
      .wait(2)
      .during(function() {
        duringCounter += 1;
      })
      .then(function() {
        done = true;
      });
    game.system.tick = 1;
    chain();
    chain();
    chain();
    assert(duringCounter === 2);
    assert(done);
  });

  it('can repeat steps', function() {
    var repeat1 = 0;
    var repeat2 = 0;
    chain
      .then(function() {
        repeat1 += 1;
      })
      .repeat(2)
      .then(function() {
        repeat2 += 1;
      })
      .repeat(2);
    chain(); // First then
    chain(); // First repeat
    chain(); // First then again
    chain(); // First repeat again
    chain(); // Second then
    chain(); // Second repeat
    chain(); // First then 3
    chain(); // First repeat 3
    chain(); // First then 4
    chain(); // First repeat 4
    chain(); // Second then 2
    assert(repeat1 === 4);
    assert(repeat2 === 2);
  });

  it('can do something every N seconds', function() {
    game.system.tick = 0.1;
    var counter = 0;
    chain
      .wait(5)
      .every(1, function() {
        counter += 1;
      });
    // Turns out that "wait" isn't an exact waiter.
    for (var i = 0; i < 75; i++) {
      chain();
    }
    assert(counter === 4);
  });

  it('calls then callback within given context', function() {
    var Fake = function() {
      this.called = false;
      this.callback = function() {
        this.called = true;
      };
      this.chain = eventChain(this)
        .then(this.callback);
    };
    var f = new Fake();
    f.chain();
    assert(f.called);
  });

  it('calls during callback within given context', function() {
    var Fake = function() {
      this.called = false;
      this.callback = function() {
        this.called = true;
      };
      this.chain = eventChain(this)
        .wait(1)
        .during(this.callback);
    };
    var f = new Fake();
    f.chain();
    assert(f.called);
  });

  it('calls every callback within given context', function() {
    game.system.tick = 0.1;
    var Fake = function() {
      this.called = false;
      this.callback = function() {
        this.called = true;
      };
      this.chain = eventChain(this)
        .wait(1)
        .every(0.1, this.callback);
    };
    var f = new Fake();
    f.chain(); // first wait
    f.chain(); // first then
    assert(f.called);
  });

  it('can end a wait conditionally', function() {
    game.system.tick = 0.1;
    var counter1 = 0, counter2 = 0;
    chain
      .wait(5)
      .orUntil(function() {
        if (counter1 > 5) {
          return true;
        }
        counter1 += 1;
      })
      .then(function() {
        counter2 += 1;
      })
      .repeat();
    // Wait is not super exact.
    for (var i = 0; i < 12; i++) {
      chain();
    }
    assert(counter1 === 6);
    assert(counter2 === 2);
  });

  it('can predicate a wait with a context', function() {
    var Fake = function() {
      this.counter = 0;
      this.chain = eventChain(this)
        .wait(5)
        .orUntil(function() {
          if (this.counter > 5) {
            return false;
          }
          this.counter += 1;
        });
    };
    game.system.tick = 0.1;
    var f = new Fake();
    // Wait is not super exact.
    for (var i = 0; i < 6; i++) {
      f.chain();
    }
    assert(f.counter === 6);
  });

  it('can wait until an animation finishes', function() {
    var fakeAnimation = {
      loopCount: 0
    };
    var done = false;
    chain
      .waitForAnimation(fakeAnimation)
      .then(function() {
        done = true;
      });
    chain();
    assert(!done);
    chain();
    assert(!done);
    chain();
    assert(!done);
    fakeAnimation.loopCount = 1;
    chain();
    chain();
    assert(done);
  });

  it('can wait until an animation loops n times', function(){
    var fakeAnimation = {
      loopCount: 0
    };
    var done = false;
    chain
      .waitForAnimation(fakeAnimation, 2)
      .then(function() {
        done = true;
      });
    chain();
    assert(!done);
    chain();
    assert(!done);
    chain();
    assert(!done);
    fakeAnimation.loopCount = 1;
    chain();
    chain();
    assert(!done);
    fakeAnimation.loopCount = 2;
    chain();
    chain();
    assert(done);
  });

  it('can wait for current animation if none specified', function() {
    var done = false;
    var Fake = function() {
      // This is supposed to mimic an Entity's currentAnim property.
      this.currentAnim = {
        loopCount: 0
      };
      this.chain = eventChain(this)
        .waitForAnimation()
        .then(function() {
          done = true;
        });
    };
    var f = new Fake();
    f.chain();
    assert(!done);
    f.chain();
    assert(!done);
    f.currentAnim.loopCount = 1;
    f.chain();
    f.chain();
    assert(done);
  });

  it('can wait for current animation to run n times if ' +
      'none specified', function() {
    var done = false;
    var Fake = function() {
      // This is supposed to mimic an Entity's currentAnim property.
      this.currentAnim = {
        loopCount: 0
      };
      this.chain = eventChain(this)
        .waitForAnimation(2)
        .then(function() {
          done = true;
        });
    };
    var f = new Fake();
    f.chain();
    assert(!done);
    f.chain();
    assert(!done);
    f.currentAnim.loopCount = 1;
    f.chain();
    f.chain();
    assert(!done);
    f.currentAnim.loopCount = 2;
    f.chain();
    f.chain();
    assert(done);
  });

  it('has a mixin function to add new event chain functions', function() {
    var context = {
      usedArg: null,
      addedStep: false
    };
    eventChain.mixin('mixinTest', function(context, steps) {
      return function(arg) {
        context.usedArg = arg;
        steps.push(function() {
          context.addedStep = true;
          steps.shift();
        });
        return this;
      };
    });
    var chain = eventChain(context)
      .mixinTest('argument');
    assert(context.usedArg === 'argument');
    chain();
    assert(context.addedStep);
  });

  it('allows chains to be re-used', function() {
    var one = false;
    var two = false;
    var three = false;
    var chain = eventChain()
      .then(function() {
        one = true;
      })
      .then(function() {
        two = true;
      })
      .then(function() {
        three = true;
      });
    assert(!one);
    assert(!two);
    assert(!three);
    chain();
    assert(one);
    assert(!two);
    assert(!three);
    chain();
    assert(two);
    assert(!three);
    chain();
    assert(three);

    chain.reset();
    one = false;
    two = false;
    three = false;

    chain();
    assert(one);
    assert(!two);
    assert(!three);
    chain();
    assert(two);
    assert(!three);
    chain();
    assert(three);
  });
});
