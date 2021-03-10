var XML_CHAR_MAP = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	'"': '&quot;',
	"'": '&apos;'
};

function escapeXml (s) {
	return s.replace(/[<>&"']/g, function (ch) {
		return XML_CHAR_MAP[ch];
	});
}

function formatXML(element, indent, options) {

	var children = element.childNodes;
	var prevNode = null;
	var whitespace = "";
	var containsText = false;

	var contents = "";
	var attrContents = "";

	for (var index in children) {
		var childNode = children[index]
		switch (childNode.nodeType) {
			case 1 : // element
				var tagIndent = "";
				var nextIndent = "";
				if (!containsText) {
					if (element.nodeType != 9) {
						nextIndent =  indent + "  ";
						tagIndent = "\n";
					}
				}

				contents += tagIndent + formatXML(childNode, nextIndent, options);
				containsText = false;
				break;
			case 3 : // text
				var value = childNode.nodeValue;
				if ($.trim(value)) {
					contents += whitespace + escapeXml(value);
					whitespace = "";
					containsText = true;
				} else {
					whitespace = value;
				}
				break;
			case 4 : // cdata
				if (!containsText) {
					if (element.nodeType != 9) {
						contents += "\n" + indent + "  ";
					}
				}
				contents += "<![CDATA[" + childNode.nodeValue + "]]>";
				break;
			case 8 : // comment
				if (!containsText) {
					if (element.nodeType != 9) {
						contents += "\n" + indent + "  ";
					}
				}
				contents += "<!--" + escapeXml(childNode.nodeValue) + "-->";
				break;
		}

		prevNode = childNode;
	}

	var attributes = element.attributes;
	if (attributes) {
		var xmlnsPattern = /^xmlns:?(.*)$/;
		var previousWasNS = false;
		for (var index = 0; index < attributes.length; index++) {
			if (previousWasNS) {
				attrContents += "\n" + indent + "   ";
				previousWasNS = false;
			}
			attrContents += " " + attributes[index].nodeName + '="' + escapeXml(attributes[index].nodeValue) +'"';
			if (xmlnsPattern.test(attributes[index].nodeName))
				previousWasNS = true;
		}
	}
	
	if (element.nodeType == 1) {
		if (contents) {
			var closingIndent = (!containsText)? "\n" + indent : "";
			return indent + "<" + element.nodeName + attrContents + ">" + contents + closingIndent + "</" + element.nodeName + ">";
		} else {
			return indent + "<" + element.nodeName + attrContents + " />";
		}
	} else {
		return contents;
	}
	
}
;
