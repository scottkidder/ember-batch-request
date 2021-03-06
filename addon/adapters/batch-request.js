import DS from 'ember-data';
import Inflector from 'ember-inflector';
import { isPresent } from '@ember/utils';

const { inflector } = Inflector;

inflector.uncountable('parallel');
inflector.uncountable('sequential');

const { JSONAPIAdapter } = DS;

export default JSONAPIAdapter.extend({
  init() {
    const apiBatchUrl = this.get('apiBatchUrl');

    if (isPresent(apiBatchUrl)) {
      inflector.uncountable(apiBatchUrl);
    }

    return this._super(arguments);
  },

  batchCreate(items, options) {
    return this._batch(items, 'POST', options);
  },

  batchUpdate(items, options) {
    return this._batch(items, 'PATCH', options);
  },

  batchDelete(items) {
    return this._batch(items, 'DELETE');
  },

  _batch(items, actionName, { skipStoreUpdate = false, useModelUrl = false }) {
    const records = items;
    const data = [];

    records.forEach((item)=> {
      const current = this._buildBatchPayload(item, actionName);

      data.push(current);
      this._changeRootStateToInflight(item);
    });

    let url;
    const { modelName } = items[0]._internalModel;
    const adapter = this.store.adapterFor(modelName);

    if (useModelUrl) {
      url = adapter.buildURL(modelName);
    } else {
      url = this.buildURL(this.get('apiBatchUrl')).replace(this.get('apiBatchUrl').dasherize()
        .pluralize(), this.get('apiBatchUrl'));
    }

    return adapter.ajax(url, actionName, { data })
    .then((result)=> {
      return this._batchResponse(result, actionName, records, skipStoreUpdate);
    });
  },

  _batchResponse(result, actionName, records, skipStoreUpdate) {
    const errorResponses = [];
    const completedResponses = [];
    const success = 200;

    result.responses.response.forEach((item)=> {
      if (item.status === success) {
        completedResponses.push(item.response);
      } else {
        errorResponses.push(item);
      }
    });

    // Deletes
    if (actionName === 'DELETE') {
      this._unloadRecordFromStore(completedResponses, records);
    // Creates and Updates
    } else if (skipStoreUpdate === false) {
      this._updateStoreOnCreateOrUpdate(completedResponses, records, actionName);
    }
    this._handleModelErrors(errorResponses, records);
    this._cleanUpInflightModels(records);
    const responses = {
      completedResponses,
      errorResponses
    };

    return responses;
  },

  _cleanUpInflightModels(records) {
    records.forEach((record)=> {
      if (record.get('isSaving') === true) {
        record.transitionTo('uncommitted');
        record.unloadRecord();
      }
    });
  },

  _changeRootStateToInflight(item) {
    const stateName = item.get('currentState.stateName');
    const allowedStates = [
      'root.loaded.created.uncommitted',
      'root.loaded.updated.uncommitted',
      'root.deleted.uncommitted'
    ];

    if (allowedStates.includes(stateName)) {
      item.transitionTo('inFlight');
    }
  },

  _unloadRecordFromStore(completedResponses, records) {
    completedResponses.forEach((body)=> {
      // a hack to handle parallel requests
      if (body.constructor === Array) {
        const ids = body.mapBy('response')
                        .mapBy('data')
                        .mapBy('id');

        ids.forEach((id)=> {
          records.findBy('id', id).unloadRecord();
        });
      } else if (body.id) {
        records.findBy('id', body.id).unloadRecord();
      } else {
        records.findBy('id', body.data.id).unloadRecord();
      }
    });
  },

  _updateStoreOnCreateOrUpdate(completedResponses, records, /* actionName */) {
    completedResponses.forEach((body)=> {
      let ids;

      if (body.constructor === Array) {
        ids = body.mapBy('response.data.id');
      } else if (body.id) {
        ids = [body.id];
      } else {
        ids = [body.data.id];
      }

      // NOTE: Should handle updating id in the create case need to use the actionName
      ids.forEach((id)=> {
        const currentRecord = records.findBy('id', id);

        this.store.didSaveRecord(currentRecord._internalModel);
      });
    });
  },

  _handleModelErrors(errorResponses, records) {
    if (errorResponses.length > 0) {
      const errors = errorResponses[0].response;
      const status = errorResponses[0].status;
      const invalid = 422;

      records.forEach((record)=> {
        const internalModel = record._internalModel;

        if (status === invalid) {
          this.store.recordWasInvalid(internalModel, errors);
        } else {
          this.store.recordWasError(internalModel, errors);
        }
      });
    }
  },

  _buildBatchPayload(item, actionName) {
    let body;

    if (actionName === 'POST') {
      body = item.serialize().data;
      body.id = item.id;
    } else if (actionName === 'PATCH') {
      body = item.serialize().data;
      body.id = item.id;
    } else if (actionName === 'DELETE') {
      body = item.id;
    }

    return body;
  }
});
