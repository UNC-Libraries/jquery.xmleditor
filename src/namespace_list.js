function NamespaceList(namespaceList) {
	this.namespaceURIs = {};
	this.namespaceToPrefix = {};
	
	if (namespaceList) {
		$.extend({}, namespaceList);
		var self = this;
		$.each(this.namespaces, function() {
			self.namespaceToPrefix[value] = key;
		});
	}
}

NamespaceList.prototype.addNamespace = function(nsURI, nsPrefix) {
	this.namespaceURIs[nsPrefix] = nsURI;
	this.namespaceToPrefix[nsURI] = nsPrefix;
};

NamespaceList.prototype.containsURI = function(nsURI) {
	return nsURI in this.namespaceToPrefix;
};

NamespaceList.prototype.containsPrefix = function(nsPrefix) {
	return nsPrefix in this.namespaceURIs;
};

NamespaceList.prototype.getNamespacePrefix = function(nsURI) {
	if (!nsURI) {
		return "";
	}

	var prefix = this.namespaceToPrefix[nsURI];
	if (prefix)
		prefix += ":";
	return prefix;
};