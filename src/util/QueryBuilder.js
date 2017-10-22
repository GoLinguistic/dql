import squel from 'squel';

export default flavor => squel.useFlavour(flavor || 'mysql');
