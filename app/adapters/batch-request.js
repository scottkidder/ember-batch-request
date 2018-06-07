import BatchRequestAdapter from 'ember-batch-request/adapters/batch-request';
import config from '../config/environment';

export default BatchRequestAdapter.extend({
  host: config.apiURL,
  /* eslint-disable ember/avoid-leaking-state-in-ember-objects */
  namespace: config.apiNamespace || '',
  apiBatchUrl: config.apiBatchUrl || '/batch'
});
