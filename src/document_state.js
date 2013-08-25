/**
 * Manages and tracks the state of the underlying document being edited.
 */
function DocumentState(baseXML, editor) {
	this.baseXML = baseXML;
	this.xml = null;
	this.changeState = 0;
	this.editor = editor;
	this.domParser = null;
	if (window.DOMParser)
		this.domParser = new DOMParser();
	this.setXMLFromString(this.baseXML);
	this.namespaces = new NamespaceList();
}

DocumentState.prototype.isChanged = function() {
	return this.changeState > 1;
};
DocumentState.prototype.isBaseDocument = function() {
	return this.changeState == 0;
};
DocumentState.prototype.changesSaved = function() {
	return this.changeState == 1;
};
DocumentState.prototype.changesSynced = function() {
	return this.changeState == 2;
};
DocumentState.prototype.changesNotSynced = function() {
	return this.changeState == 3;
};

DocumentState.prototype.documentChangedEvent = function() {
	this.changeState = 2;
	this.editor.undoHistory.captureSnapshot();
	this.updateStateMessage();
};

DocumentState.prototype.changesCommittedEvent = function() {
	this.changeState = 1;
	this.updateStateMessage();
};

DocumentState.prototype.changeEvent = function() {
	if (this.changeState < 2)
		this.changeState = 2;
	this.updateStateMessage();
};

DocumentState.prototype.syncedChangeEvent = function() {
	this.changeState = 2;
	this.updateStateMessage();
};

DocumentState.prototype.unsyncedChangeEvent = function() {
	this.changeState = 3;
	this.updateStateMessage();
};

DocumentState.prototype.updateStateMessage = function () {
	if (this.isChanged()) {
		$("." + submissionStatusClass).html("Unsaved changes");
	} else {
		$("." + submissionStatusClass).html("All changes saved");
	}
};

DocumentState.prototype.addNamespace = function(prefixOrType, namespace) {
	var prefix;
	if (typeof prefixOrType === "object"){
		// When adding a ns from a schema definition, use schema prefix
		namespace = prefixOrType.namespace;
		prefix = this.editor.xmlTree.namespaces.getNamespacePrefix(namespace);
	} else {
		prefix = prefixOrType;
	}
		
	if (this.namespaces.containsURI(namespace))
		return;
	if (!prefix)
		prefix = "ns";
	var nsPrefix = prefix;
	var i = 0;
	while (nsPrefix in this.namespaces.namespaceURIs)
		nsPrefix = prefix + (++i);
	
	var documentElement = this.xml[0].documentElement;
	if (documentElement.setAttributeNS)
		documentElement.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:' + nsPrefix, namespace);
	else documentElement.setAttribute('xmlns:' + nsPrefix, namespace);
	this.namespaces.addNamespace(namespace, nsPrefix);
}

DocumentState.prototype.extractNamespacePrefixes = function(nsURI) {
	var prefix = null;
	var attributes = this.xml.children()[0].attributes;
	var self = this;
	$.each(attributes, function(){
		var key = this.name;
		var value = this.value;
		if (key.indexOf("xmlns") == 0){
			if ((prefixIndex = key.indexOf(":")) > 0){
				prefix = key.substring(prefixIndex+1)
			} else {
				prefix = "";
			}
			self.namespaces.addNamespace(value, prefix);
		}
	});
};

DocumentState.prototype.getIEXMLParser = function() {
	var progIDs = [ 'Msxml2.DOMDocument.6.0', 'Msxml2.DOMDocument.3.0', 'Microsoft.XMLDOM' ];
	for (var i = 0; i < progIDs.length; i++) {
		try {
			var xmlDOM = new ActiveXObject(progIDs[i]);
			return xmlDOM;
		} catch (e) { }
	}
	return null;
};

DocumentState.prototype.setXMLFromString = function(xmlString) {
	// Strip out weird namespace header that IE adds to the document
	var xmlDoc,
		nsHeaderIndex = xmlString.indexOf('<?XML:NAMESPACE');
	if (nsHeaderIndex != -1) {
		nsHeaderIndex = xmlString.indexOf('/>', nsHeaderIndex);
		xmlString = xmlString.substring(nsHeaderIndex + 2);
	}
	if (this.editor.options.prettyXML) {
		xmlString = vkbeautify.xml(xmlString);
	}
	// parseXML doesn't return any info on why a document is invalid, so do it the old fashion way.
	if (this.domParser) {
		xmlDoc = this.domParser.parseFromString(xmlString, "application/xml");
		var parseError = xmlDoc.getElementsByTagName("parsererror");
		if (parseError.length > 0){
			throw new Error($(parseError).text());
		}
	} else {
		xmlDoc = this.getIEXMLParser();
		xmlDoc.async = false;
		xmlDoc.loadXML(xmlString);
		if (xmlDoc.parseError.errorCode != 0) {
			throw new Error("Error in line " + xmlDoc.parseError.line + " position " + xmlDoc.parseError.linePos
					+ "\nError Code: " + xmlDoc.parseError.errorCode + "\nError Reason: "
					+ xmlDoc.parseError.reason + "Error Line: " + xmlDoc.parseError.srcText);
		}
	}
	
	this.xml = $(xmlDoc);
	if (this.editor.guiEditor != null && this.editor.guiEditor.rootElement != null)
		this.editor.guiEditor.rootElement.xmlNode = this.xml.children().first();
	if (this.editor.guiEditor.xmlContent != null)
		this.editor.guiEditor.xmlContent.data("xml").elementNode = this.xml.children().first();
	if (this.editor.problemsPanel != null)
		this.editor.clearProblemPanel();
};
