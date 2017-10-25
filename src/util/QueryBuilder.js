// @flow
import squel from 'squel';

export default (flavor: string) => squel.useFlavour(flavor || 'mysql');
