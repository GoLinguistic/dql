class Processor {
    constructor(queryBuilder) {
        this._qb = queryBuilder;
    }

    process(root, node, variables) {
        throw new Error('No process() method implemented for this class');
    }
}

export default Processor;
