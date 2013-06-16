/**
 * Manages the history of changes that have occurred.
 */
function UndoHistory(editor) {
	this.states = [];
	this.headIndex = -1;
	this.stateChangeEvent = null;
	this.stateCaptureEvent = null;
	this.editor = editor;
}

UndoHistory.prototype.setStateChangeEvent = function(event) {
	this.stateChangeEvent = event;
	return this;
};

UndoHistory.prototype.setStateCaptureEvent = function(event) {
	this.stateCaptureEvent = event;
	return this;
};

UndoHistory.prototype.cloneNewDocument = function(originalDoc) {
	var newDoc = originalDoc.implementation.createDocument(
		originalDoc.namespaceURI, null, null
	);
	var newNode = newDoc.importNode(originalDoc.documentElement, true);
	newDoc.appendChild(newNode);
	return $(newDoc);
};

UndoHistory.prototype.changeHead = function(step){
	console.profile();
	if ((step < 0 && this.headIndex + step < 0) 
			|| (step > 0 && this.headIndex + step >= this.states.length
			||  this.headIndex + step >= this.editor.options.undoHistorySize))
		return;
	
	this.headIndex += step;
	this.editor.xmlState.xml = this.cloneNewDocument(this.states[this.headIndex][0]);
	
	this.editor.refreshDisplay();
	
	if (this.stateChangeEvent != null)
		this.stateChangeEvent(this);
	console.profileEnd();
};

UndoHistory.prototype.captureSnapshot = function () {
	if (this.editor.options.undoHistorySize <= 0)
		return;
	
	if (this.headIndex < this.states.length - 1) {
		this.states = this.states.slice(0, this.headIndex + 1);
	}
	
	if (this.states.length >= this.editor.options.undoHistorySize) {
		this.states = this.states.slice(1, this.states.length);
	}

	this.headIndex = this.states.length;

	this.states.push(this.cloneNewDocument(this.editor.xmlState.xml[0]));
	
	if (this.stateCaptureEvent != null)
		this.stateCaptureEvent(this);
};
