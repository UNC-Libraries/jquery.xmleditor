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

NamespaceList.prototype.addToJQuery = function() {
	$.each(this.namespaceURIs, function (prefix, value) {
		$.xmlns[prefix] = value;
	});
};

NamespaceList.prototype.addNamespace = function(nsURI, nsPrefix) {
	this.namespaceURIs[nsPrefix] = nsURI;
	this.namespaceToPrefix[nsURI] = nsPrefix;
};

NamespaceList.prototype.containsURI = function(nsURI) {
	return nsURI in this.namespaceToPrefix;
};

NamespaceList.prototype.containsPrefix = function(namespacePrefix) {
	return nsPrefix in this.namespaceURIs;
};

NamespaceList.prototype.getNamespacePrefix = function(nsURI) {
	var prefix = this.namespaceToPrefix[nsURI];
	if (prefix)
		prefix += ":";
	return prefix;
};