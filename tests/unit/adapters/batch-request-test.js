import DS from 'ember-data';
import { module, skip, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import BatchRequestAdapter from 'ember-batch-request/adapters/batch-request';
import { run } from '@ember/runloop';

const { Model, Store, attr } = DS;

module('Unit | Adapters | batch request', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    this.subject = function() {
      const fauxAdapter = BatchRequestAdapter.extend({});
      const myModel = Model.extend({
        name: attr('string')
      });

      myModel.store = Store.extend({});

      this.owner.register('test-container:faux-adapter', fauxAdapter);
      this.owner.register('model:faux-model', myModel);

      return this.owner.lookup('test-container:faux-adapter');
    };

    this.store = this.owner.lookup('service:store');
  });

  test('changes the state to inflight', function (assert) {
    const subject = this.subject();
    let item = null;
    run.next(()=>{
      item = this.store.createRecord( 'faux-model', {id:1, name: "Blah ${i}"});
      subject._changeRootStateToInflight(item);
      assert.equal(item.get('currentState.stateName'), 'root.loaded.created.inFlight', 'Model status was set to inflight');
      item.transitionTo('uncommitted');
    });
  });

  skip('cleans up inflight models', function (assert) {
    const subject = this.subject();
    let item = null;
    run.next(()=>{
      item = this.store.createRecord( 'faux-model', {id:1, name: "Blah ${i}"});
      subject._changeRootStateToInflight(item);
      subject._cleanUpInflightModels([item]);
      assert.equal(item.get('isDeleted') , true, 'Inflight models were cleaned up');
    });
  });
});
