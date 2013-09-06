/**
 * Manages the history of changes that have occurred, to allow progression forward
 * or backward through a limited history of modifications to the xml document
 * Current implementation involves storing previous states of the XML document,
 * recorded each time a significant change occurs or the document is regenerated
 */
function UndoHistory(xmlState, editor) {
	this.xmlState = xmlState;
	this.editor = editor;
	// History of document states
	this.states = [];
	// Index of the currently active history state
	this.headIndex = -1;
	// Callback triggered after a change is undone or redone
	this.stateChangeEvent = null;
	// Callback triggered after a new state is added to the history
	this.stateCaptureEvent = null;
	// Disable undo history if the browser doesn't support cloning documents
	this.disabled = (typeof(document.implementation.createDocument) == "undefined");
}

UndoHistory.prototype.setStateChangeEvent = function(event) {
	this.stateChangeEvent = event;
	return this;
};

UndoHistory.prototype.setStateCaptureEvent = function(event) {
	this.stateCaptureEvent = event;
	return this;
};

// Clones an XML document and returns the new document
UndoHistory.prototype.cloneNewDocument = function(originalDoc) {
	if (this.disabled) return;
	var newDoc = originalDoc.implementation.createDocument(
		originalDoc.namespaceURI, null, null
	);
	var newNode = newDoc.importNode(originalDoc.documentElement, true);
	newDoc.appendChild(newNode);
	return $(newDoc);
};

// Move the current active document to a different version from the history.
// The step parameter indicates how many versions to move, and determines the direction to 
// move as well, where a negative number will undo changes, and a positive will redo.
UndoHistory.prototype.changeHead = function(step){
	if (this.disabled) return;
	if ((step < 0 && this.headIndex + step < 0) 
			|| (step > 0 && this.headIndex + step >= this.states.length
			||  this.headIndex + step >= this.editor.options.undoHistorySize))
		return;
	
	this.headIndex += step;
	// Clone the newly selected document head, otherwise this state would be lost from 
	// the history when any new changes were made
	this.xmlState.xml = this.cloneNewDocument(this.states[this.headIndex][0]);
	
	if (this.stateChangeEvent != null)
		this.stateChangeEvent(this);
};

// Capture the current state of the XML document into the document history
UndoHistory.prototype.captureSnapshot = function () {
	if (this.disabled) return;
	if (this.editor.options.undoHistorySize <= 0)
		return;
	
	if (this.headIndex < this.states.length - 1) {
		this.states = this.states.slice(0, this.headIndex + 1);
	}
	
	if (this.states.length >= this.editor.options.undoHistorySize) {
		this.states = this.states.slice(1, this.states.length);
	}

	this.headIndex = this.states.length;

	this.states.push(this.cloneNewDocument(this.xmlState.xml[0]));
	
	if (this.stateCaptureEvent != null)
		this.stateCaptureEvent(this);
};
