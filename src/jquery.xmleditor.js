//= require_self
//= require_tree .

/*

	Copyright 2008 The University of North Carolina at Chapel Hill

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

			http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

 */
/*
 * jQuery xml Editor
 * 
 * Dependencies:
 *   jquery 1.7+
 *   jquery.ui 1.9+
 *   ajax ace editor
 *   jquery.autosize.js (optional)
 * 
 * @author Ben Pennell
 */
 
// Selector and class name constants
var menuContainerClass = "xml_menu_container";
var menuHeaderClass = "menu_header";
var menuColumnClass = "xml_menu_column";
var menuContentClass = 'menu_content';
var menuExpandDuration = 180;
var xmlElementClass = 'xml_element';
var xmlTextClass = 'xml_text_node';
var xmlNodeClass = 'xml_node';
var topLevelContainerClass = 'top_level_element_group';
var elementRootPrefix = "root_element_";
var elementPrefix = "xml_element_";
var childrenContainerSelector = " > .xml_children";
var childrenContainerClass = "xml_children";
var attributeContainerClass = "attribute_container";
var attributesContainerSelector = " > .xml_attrs";
var attributesContainerClass = "xml_attrs";
var xmlMenuHeaderPrefix = "xml_header_item_";
var xmlEditorContainerClass = "xml_editor_container";
var xmlWorkAreaContainerClass = "xml_work_area";
var addTopMenuClass = "add_top_menu";
var addAttrMenuClass = "add_attribute_menu";
var addElementMenuClass = "add_element_menu";
var addNodeMenuClass = "add_node_menu";
var xmlMenuBarClass = "xml_menu_bar";
var submitButtonClass = "send_xml";
var submissionStatusClass = "xml_submit_status";
var xmlContentClass = "xml_content";

var editorTabAreaClass = "xml_tab_area";
var problemsPanelClass = "xml_problems_panel";
var guiContentClass = "gui_content";
var textContentClass = "text_content";
var editorHeaderClass = "xml_editor_header";

// Returns the local name of a node.  Needed for older versions of ie
var localName = function(node) {
	var localName = node.localName;
	if (localName) return localName;
	var index = node.nodeName.indexOf(':');
	if (index == -1) return node.nodeName;
	return node.nodeName.substring(index + 1);
};

// Extracts and returns URL parameters or the given default.
function getParam(name, def) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? def : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Add method to String.
String.prototype.replaceAll = function(search, replace) {
    //if replace is null, return original string otherwise it will
    //replace search string with 'undefined'.
    if(!replace) 
        return this;
    return this.replace(new RegExp('[' + search + ']', 'g'), replace);
};

// Extract the user language first from the browsers default and let it overwrite via URL parameter "lang=".
var userLang = navigator.language || navigator.userLanguage;
userLang = getParam("lang", userLang);
if ("de" != userLang && "en" != userLang) {
	userLang = "en";
}

$.widget( "xml.xmlEditor", {
	options: {
		// Schema object to be used
		schema: null,
		// Whether or not to attempt to load the schema in a worker thread, if available
		loadSchemaAsychronously: true,
		// Path to directory containing cycle.js, needed for loadSchemaAsychronously
		libPath: null,
		// Document retrieval and upload parameters
		ajaxOptions : {
			xmlUploadPath: null,
			xmlRetrievalPath: null,
			xmlRetrievalParams : null
		},

		// User set default template settings
		templateOptions : {
			templatePath : false,
			templates : [],
			cancelFunction : false
		},

		// Function triggered after uploading XML document, to interpret if the response was successful or not.  If upload failed, an error message should be returned.
		submitResponseHandler : null,
		// Function triggered after uploading XML document, if an error occurs. Gives full text of error, instead of a boilerplate "500 server error" message.
		submitErrorHandler : null,

		submitButtonConfigs : null,
		// Event function trigger after an xml element is update via the gui
		elementUpdated : undefined,
		// Title for the document, displayed in the header
		documentTitle : null,
		
		// Set to false to get rid of the 
		enableDocumentStatusPanel : true,
		documentStatusPanelDomId : "<div>",
		confirmExitWhenUnsubmitted : true,
		enableGUIKeybindings : true,
		floatingMenu : true,
		// Requires jquery.autosize, defaults to false if plugin isn't detected
		expandingTextAreas: true,
		
		// Pretty formatting of XML output.  Requires vkbeauty.js, defaults to false is not available
		prettyXML : true,
		// Number of history states held for the undo feature
		undoHistorySize: 20,
		// Object containing additional entries to add to the header menu
		menuEntries: undefined,
		enforceOccurs: false,
		prependNewElements: false,
		autocomplete: true,
		
		targetNS: null,

		// Flag to disable the export button
		showExport: true,
		
		// Switch to readonly mode
		enableEdit: true,
		
		// Hide the ability to switch between the modes
		sourceDesignSwitch: true,
		
		// Switch to predefined view: XML or HTML-DIV editor. 0=HTML-DIV editor, 1=XML Source editor
		initialEditMode: 0,

		// i18n resources
		i18n: { 
			"en": {
				uploadedFiles:"Uploaded files:",
				addNodes:"Add nodes",
				addRoot:"Add top element",
				addAttribute:"Add attribute",
				addElement:"Add Element",
				addSubelement:"Add subelement",
				insert:"Insert",
				xml:"Design",
				text:"Source",
				editing:"Editing ",
				noBrowserExportSupport:"Browser does not support saving files via this editor.  To save, copy and paste the document from the Text view.",
				filename:"Filename",
				saveFailedXmlInvalid:"The XML is not valid. The content cannot be processed.",
				saveFailedSeeErrors:"Save failed<br/>See error message.",
				export:"Export",
				download:"Download",
				submitting:"Processing...",
				failedToSubmit:"The XML document could not be successfully submitted",
				documentUnchanged:"No changes",
				submitChanges:"Apply",
				noElements:"There are no elements in this document.  Use the menu on the right to add new top level elements.",
				unsavedChanges:"Unapplied changes",
				savedChanges:"Changes applied.",
				couldNotAdd1:"Could not add child ",
				couldNotAdd2:", it is not a valid child of ",
				couldNotAddAttr1:"Could not add attribute ",
				couldNotAddAttr2:", it is not a valid for element ",
				noDocument:"Could not load specified document and no fallback provided, cannot start.",
				noStartingDocument:"No starting document.",
				failedToAddChild:"Failed to add child of type ",
				undo:"ctrl+z",
				redo:"ctrl+y",
				del:"del",
				enter:"enter",
				elementUp:"alt+up",
				elementDown:"alt+down",
				esc:"esc",
				down:"down",
				up:"up",
				left:"left",
				right:"right",
				shiftDown:"shift+down",
				shiftUp:"shift+up",
				shiftLeft:"shift+left",
				shiftRight:"shift+right",
				altA:"alt+a",
				ltShiftE:"alt+shift+e",
				altShiftX:"alt+shift+x",
				altShiftS:"alt+shift+s",
				altShiftT:"alt+shift+t",
				file:"File",
				edit:"Edit",
				select:"Select",
				view:"View",
				options:"Options",
				deselect:"Deselect",
				nextElement:"Next Element",
				previousElement:"Previous Element",
				parentElement:"Parent",
				firstChild:"First Child",
				nextSibling:"Next Sibling",
				previousSibling:"Previous Sibling",
				nextAttribute:"Next Attribute",
				previousAttribute:"Previous Attribute",
				deleteElement:"Delete",
				moveElementUp:"Move up",
				moveElementDown:"Move down",
				undoMenuitem:"Undo",
				redoMenuitem:"Redo",
				switchToXml:"Graphical XML",
				switchToText:"Raw XML",
				prettifyXml:"Automatic XML formatting",
				enableShortcuts:"Enable shortcuts",
				enforceMinMaxOccurs:"Enforce Min/Max",
				prependNewElements:"Prepend adding new elements",
				noConnection:"No connection.\nPlease check network.",
				pageNotFound:"The requested page could not be found. [404]",
				internalServerError:"Internal server error [500].",
				jsonParseFailed:"JSON parse failed.",
				timeout:"timeout while contacting server.",
				ajaxAborted:"AJAX request aborted.",
				uncaughtError:"Unexpected error\n",
				xmlSerializerNotSupported:"XML Serializer not supported.",
				alreadyExistent:"Already existent",
				useTheMenuToAddSubElementsAndAttr:"Use the menu to add subelements and attributes.",
				useTheMenuToAddAttr:"Use the menu to add attributes.",
				useTheMenuToAddSubElements:"Use the menu to add subelements.",
				cannotSubmitNoPostOption:"Cannot submit because no post Options",
				useMenuToAdd:"Use the menu to add subelements, attributes and text.",
				useMenuToAddAttributesText:"Use the menu to add attributes and text.",
				useMenuToAddSubelementsText:"Use the menu to add subelements and text.",
				useMenuToAddText:"Use the menu to add text.",
				useMenuToAddSubelementsAttributes:"Use the menu to add subelements and attributes.",
				useMenuToAddAttributes:"Use the menu to add attributes.",
				useMenuToAddSubelements:"Use the menu to add subelements.",
				unableToAddFixSyntax:"Unable to add element, please fix existing XML syntax first.",
				addCData:"Add CDATA",
				addComment:"Add Comment",
				addText:"Add Text",
				add:"Add ",
				xmlDocErrorInLine:"Error in line ",
				xmlDocErrorAtPos:" position ",
				xmlDocErrorCode:"Error Code: ",
				xmlDocErrorReason:"Error Reason: ",
				xmlDocErrorLine:"Error Line: ",
				addChildElement:"Add child element",
				addSiblingElement:"Add sibling element",
				addElementToParent:"Add element to parent",
				addElementToRoot:"Add element to root",
				addTextToElement:"Add text to element",
				addCommentToElement:"Add comment to element",
				addCDataToElement:"Add CDATA to element",
				altE:"alt+2",
				altS:"alt+s",
				altP:"alt+p",
				altR:"alt+r",
				altT:"alt+t",
				altSlash:"alt+/",
				altComma:"alt+,",
				cancel:"Cancel",
				choose:"Choose",
				unableToLoadTemplate:"Unable to load the requested template: ",
				useMenuToAddContents:"Use the menu to add contents."
			},
			"de": {
				uploadedFiles:"Hochgeladene Dateien:",
				addNodes:"Elemente hinzufügen",
				addRoot:"Hauptelement hinzufügen",
				addAttribute:"Attribut hinzufügen",
				addElement:"Element hinzufügen",
				addSubelement:"Unterelement hinzufügen",
				insert:"Einfügen",
				xml:"Design",
				text:"Quelle",
				editing:"Bearbeite ",
				noBrowserExportSupport:"Ihr Webbrowser unterstützt das übernehmen der Inhalte nicht. Um die Inhalte zu speichern wechseln sie bitte in the Textansicht und markieren und kopieren sie den Inhalt.",
				filename:"Dateiname",
				saveFailedXmlInvalid:"XML ist ungültig. Daten können nicht verarbeitet werden.",
				saveFailedSeeErrors:"Die Übernahme der Änderungen ist fehlgeschlagen<br/>Siehe Fehlermeldung.",
				export:"Export",
				download:"Download",
				submitting:"Verarbeite...",
				failedToSubmit:"Das XML Dokument konnte nicht verabeitet werden",
				documentUnchanged:"Keine Änderungen",
				submitChanges:"Übernehmen",
				noElements:"Das XML Dokument ist leer. Verwenden sie das Menü rechts um ein neuen Hauptelement einzufügen.",
				unsavedChanges:"Nicht übernommene Änderungen",
				savedChanges:"Änderungen gespeichert",
				couldNotAdd1:"Das Kind-Element  ",
				couldNotAdd2:" kann nicht hinzugefügt werden, da es kein gültiges Kind des folgenden Tags is: ",
				couldNotAddAttr1:"Das Attribut ",
				couldNotAddAttr2:"kann nicht hinzugefügt werden, da es kein gültiges Attribut des folgenden Tags ist: ",
				noDocument:"Das angegebene Dokument konnte nicht geladen werden und es ist kein Rückfalldokument definiert. Der Editor kann nicht starten.",
				noStartingDocument:"Es ist kein Startdokument definiert.",
				failedToAddChild:"Das Element des folgenden Typs konnte nicht hinzugefügt werden: ",
				undo:"Strg+z",
				redo:"Strg+y",
				del:"Entf",
				enter:"Enter",
				elementUp:"Alt+oben",
				elementDown:"Alt+unten",
				esc:"Esc",
				down:"unten",
				up:"oben",
				left:"links",
				right:"rechts",
				shiftDown:"Umschalt+unten",
				shiftUp:"Umschalt+oben",
				shiftLeft:"Umschalt+links",
				shiftRight:"Umschalt+rechts",
				altA:"alt+a",
				altShiftE:"Alt+Umschalt+e",
				altShiftX:"Alt+Umschalt+x",
				altShiftS:"Alt+Umschalt+s",
				altShiftT:"Alt+Umschalt+t",
				file:"Datei",
				edit:"Bearbeiten",
				select:"Auswählen",
				view:"Ansicht",
				options:"Optionen",
				deselect:"Abwählen",
				nextElement:"Nächstes Element",
				previousElement:"Vorheriges Element",
				parentElement:"Eine Ebene höher",
				firstChild:"Erstes Unterelement",
				nextSibling:"Nächstes Paar",
				previousSibling:"Vorheriges Paar",
				nextAttribute:"Nächstes Attribut",
				previousAttribute:"Vorheriges Attribut",
				deleteElement:"Löschen",
				moveElementUp:"nach oben",
				moveElementDown:"nach unten",
				undoMenuitem:"Rückgängig",
				redoMenuitem:"Wiederherstellen",
				switchToXml:"Grafische XML Anzeige",
				switchToText:"XML-Quelle",
				prettifyXml:"Automatische XML Formatierung",
				enableShortcuts:"Direktzugriffstasten aktiv",
				enforceMinMaxOccurs:"Min/Max Vorgaben erzwingen",
				prependNewElements:"Keine neuen Elemente zulassen",
				noConnection:"Kann keine Verbindung aufbauen.\nBitte Netzwerkverbindung prüfen.",
				pageNotFound:"Die angeforderte Seite wurde nicht gefunden. [404]",
				internalServerError:"Interner Server Fehler [500].",
				jsonParseFailed:"Parsen des angeforderten JSON ist fehlgeschlagen.",
				timeout:"Zeitüberschreitung der Serververbindung.",
				ajaxAborted:"AJAX Anfrage abgebrochen.",
				uncaughtError:"Unerwarteter Fehler.\n",
				xmlSerializerNotSupported:"XML Serialisierung nicht unterstützt.",
				alreadyExistent:"Existiert bereits",
				useTheMenuToAddSubElementsAndAttr:"Weitere Elemente und Attribute über das Menü rechts hinzufügen.",
				useTheMenuToAddAttr:"Weitere Attribute über das Menü hinzufügen.",
				useTheMenuToAddSubElements:"Weitere Elemente über das Menü rechts hinzufügen.",
				cannotSubmitNoPostOption:"Datei kann nicht übertragen werden - keine HTTP POST Optionen definiert.",
				useMenuToAdd:"Unterelemente, Attribute und Text können über das Menü hinzugefügt werden.",
				useMenuToAddAttributesText:"Attribute und Text können über das Menü hinzugefügt werden.",
				useMenuToAddSubelementsText:"Unterelemente und Text können über das Menü hinzugefügt werden.",
				useMenuToAddText:"Text kann über das Menü hinzugefügt werden.",
				useMenuToAddSubelementsAttributes:"Unterelemente und Attribute können über das Menü hinzugefügt werden.",
				useMenuToAddAttributes:"Attribute können über das Menü hinzugefügt werden.",
				useMenuToAddSubelements:"Unterelemente können über das Menü hinzugefügt werden.",
				unableToAddFixSyntax:"Element kann nicht hinzugefügt werden. Bitte zuerst die XML Syntax korrigieren.",
				addCData:"CDATA hinzufügen",
				addComment:"Kommentar hinzufügen",
				addText:"Text hinzufügen",
				add:"Hinzufügen von ",
				xmlDocErrorInLine:"Fehler in der Zeile ",
				xmlDocErrorAtPos:" an Position ",
				xmlDocErrorCode:"Fehlercode: ",
				xmlDocErrorReason:"Fehlergrund: ",
				xmlDocErrorLine:"Fehlerzeile: ",
				addChildElement:"Kind-Element hinzufügen",
				addSiblingElement:"Schwesterelement hinzufügen",
				addElementToParent:"Element zum übergeordneten Element hinzufügen",
				addElementToRoot:"Element zum Wurzelelement hinzufügen",
				addTextToElement:"Text zum Element hinzufügen",
				addCommentToElement:"Kommentar zum Element hinzufügen",
				addCDataToElement:"CDATA zum Element hinzufügen",
				altE:"Alt+2",
				altS:"Alt+s",
				altP:"Alt+p",
				altR:"Alt+r",
				altT:"Alt+t",
				altSlash:"Alt+/",
				altComma:"Alt+,",
				cancel:"Abbrechen",
				choose:"Auswählen",
				unableToLoadTemplate:"Die gewählte Vorlage konnte nicht geladen werden: ",
				useMenuToAddContents:"Inhalte können über das Menü hinzugefügt werden."
			}
		},

		userLang: getParam("lang", "en")

	},
	
	_create: function() {
		var self = this;
		var schema = this.options.schema;
		var libPath = this.options.libPath;

		this.instanceNumber = $("xml-xmlEditor").length;
		
		// Tree of xml element types
		this.schemaTree = null;
		// State of the XML document
		this.xmlState = null;
		// Container for the entire editor
		this.xmlEditorContainer = null;
		// Container for the subeditors
		this.xmlWorkAreaContainer = null;
		// Tabbed container for differentiating between specific subeditors
		this.xmlTabContainer = null;
		// Header container for the menu and top level info
		this.editorHeader = null;
		// Panel for displaying errors
		this.problemsPanel = null;
		// GUI Editor object
		this.guiEditor = null;
		// Text Editor object
		this.textEditor = null;
		// Currently active editor
		this.activeEditor = null;
		// History manager for undo/redo
		this.undoHistory = null;
		// Top level menu bar object
		this.menuBar = null;
		// Element modification object
		this.modifyMenu = null;
		// Flag indicating if the editor was initialized on a text area that will need to be updated
		this.isTextAreaEditor = false;

		var url = document.location.href;
		var index = url.lastIndexOf("/");
		if (index != -1)
			this.baseUrl = url.substring(0, index + 1);
		
		// Detect optional features
		if (!$.isFunction($.fn.autosize))
			this.options.expandingTextAreas = false;
		
		if (typeof(this.options.schema) != 'function') {
			// Turn relative paths into absolute paths for the sake of web workers
			var path_regx = /^https?:\/\/.*?\//;
			var matches = this.baseUrl.match(path_regx);

			// Turn relative paths into absolute paths for the sake of web workers
			if (libPath) {
				// Check for trailing slash. Add if needed, otherwise libPath breaks
				libPath = (/\/$/.test(libPath)) ? libPath : libPath + '/';

				if (!path_regx.test(libPath)) {
					if (libPath.indexOf('/') === 0) {
						this.libPath = matches[0] + libPath.substr(1, libPath.length);
					} else {
						this.libPath = this.baseUrl + libPath;
					}
				} else  {
					this.libPath = libPath;
				}
			} else {
				this.libPath = this.baseUrl + "lib/";
			}

			if ((typeof schema == 'string' || typeof schema instanceof String)) {
				// if http(s) just return the schema untouched
				if (!path_regx.test(schema)) {
					if (schema.indexOf('/') === 0) {
						// Relative to root
						this.options.schema = matches[0] + schema.substr(1, schema.length);
					} else {
						// Relative to current path
						this.options.schema = this.baseUrl + schema;
					}
				}
			}
		}

		// Load the schema
		this.loadSchema(this.options.schema);
	},
 
	_init: function() {
		if (this.options.submitButtonConfigs) {
			// User provided button configuration
			this.submitButtonConfigs = this.options.submitButtonConfigs;
		} else {
			// Simple button configuration, generate defaults
			var exporting = !this.options.ajaxOptions.xmlUploadPath;

			// Either an upload button or an export button
			this.submitButtonConfigs = [{
				url : this.options.ajaxOptions.xmlUploadPath,
				label : exporting? "Export" : "Submit changes",
				onSubmit : exporting? this.exportXML : null,
				disabled : typeof(Blob) === undefined && exporting
			}];
		}

		if (this.options.submitErrorHandler == null) {
			this.options.submitErrorHandler = function(jqXHR, exception) {
				if (jqXHR.status === 0) {
					alert(this.options.i18n[this.options.userLang].noConnection);
				} else if (jqXHR.status == 404) {
					alert(this.options.i18n[this.options.userLang].pageNotFound);
				} else if (jqXHR.status == 500) {
					alert(this.options.i18n[this.options.userLang].internalServerError);
				} else if (exception === 'parsererror') {
					alert(this.options.i18n[this.options.userLang].jsonParseFailed);
				} else if (exception === 'timeout') {
					alert(this.options.i18n[this.options.userLang].timeout);
				} else if (exception === 'abort') {
					alert(this.options.i18n[this.options.userLang].ajaxAborted);
				} else {
					alert(this.options.i18n[this.options.userLang].uncaughtError + jqXHR.responseText);
				}
			};
		}

		// Retrieve the local xml content before we start populating the editor.
		var localXMLContent = null;
		if (this.element.is("textarea")) {
			// Editor initialized on a text area.  Move text area out of the way and hide it
			// so that it can be updated with document changes.
			this.isTextAreaEditor = true;
			// Capture the existing value in the text area in case we are using a local document
			// Retrieving text instead of val because of firefox inconsistencies
			localXMLContent = this.element.text();
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass);
			$(this.element)
				.before(this.xmlEditorContainer)
				.hide();
		} else {
			if (this.element.children().length > 0) {
				// If the content is embedded as part of the html, retrieve it as such.
				// Note, this is case insensitive and can leave to problems
				localXMLContent = this.element.html();
			} else {
				// Content is probably XML encoded
				localXMLContent = this.element.text();
			}
			
			// Clear out the contents of the element being initialized on
			this.element.text("");
			
			// Add the editor into the dom
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass).appendTo(this.element);
		}
		this.xmlState = null;
		this.xmlWorkAreaContainer = null;
		this.xmlTabContainer = null;
		
		this.editorHeader = null;
		this.problemsPanel = null;
		
		this.guiEditor = new GUIEditor(this);
		this.textEditor = new TextEditor(this);
		this.activeEditor = this.guiEditor;
		
		var self = this;
		
		this.menuBar = new MenuBar(this);
		this.menuBar.updateFunctions.push(this.refreshMenuUndo);
		this.menuBar.updateFunctions.push(this.refreshMenuSelected);
		if (this.options.menuEntries) {
			$.each(this.options.menuEntries, function() {
				self.menuBar.addEntry(this);
			});
		}
		this.modifyMenu = new ModifyMenuPanel(this);
		
		if (this.options.confirmExitWhenUnsubmitted) {
			$(window).bind('beforeunload', function(e) {
				if (self.xmlState != null && self.xmlState.isChanged()) {
					return this.options.i18n[this.options.userLang].unsavedChanges;
				}
			});
		}
		
		// Load any external vocabularies
		this.loadVocabularies(this.options.vocabularyConfigs);

		// Start loading the document for editing
		this.loadDocument(this.options.ajaxOptions, localXMLContent);
		var editor = this.activeEditor;
		setTimeout(function () { if (!!editor['selectNext']) { editor.selectNext(); } }, 200);
	},
	
	// Load the schema object
	loadSchema: function(schema) {
		var self = this;
		// If the schema is a function, execute it to get the schema from it.
		if (jQuery.isFunction(schema)) {
			this.schema = schema.apply();
			self._schemaReady();
		} else {
			// Load schema in separate thread for browsers tha support it.  IE10 blocked to avoid security error
			if (this.options.loadSchemaAsychronously && !window.MSBlobBuilder
					&& typeof(window.URL) !== "undefined" && typeof(Worker) !== "undefined" && typeof(Blob) !== "undefined") {
				var blob = new Blob([
						"self.onmessage = function(e) {" +
						"importScripts(e.data.libPath + 'cycle.js');" +
						"var schema;" +
						"if (typeof e.data.schema == 'string' || typeof e.data.schema instanceof String) {" +
						"	var xmlhttp = new XMLHttpRequest();" +
						"	xmlhttp.onreadystatechange = function() {" +
						"		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {" +
						"			schema = eval('(' + xmlhttp.responseText + ')');" +
						"			self.postMessage(JSON.retrocycle(schema));" +
						"		}" +
						"	};" +
						"	xmlhttp.open('GET', e.data.schema, true);" +
						"	xmlhttp.send();" +
						"} else {" +
						"	schema = JSON.retrocycle(e.data.schema);" +
						"	self.postMessage(schema);" +
						"}" +
						"}"
				], { type: "text/javascript" });
				var worker = new Worker(window.URL.createObjectURL(blob));
				worker.onmessage = function(e) {
					self.schema = e.data;
					self._schemaReady();
					worker.terminate();
				};
				worker.onerror = function(e) {
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				};
				worker.postMessage({'schema' : schema, 'libPath' : this.libPath});
			} else {
				// Fallback with synchronous retrocycling
				if (typeof schema == 'string' || typeof schema instanceof String) {
					$.ajax({
						url : schema,
						async : self.options.loadSchemaAsynchronously,
						dataType : 'json',
						success : function(data) {
							self.schema = JSON.retrocycle(data);
							self._schemaReady();
						}
					});
				} else {
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				}
			}
		}
	},
	
	// Load the XML document for editing
	loadDocument: function(ajaxOptions, localXMLContent) {
		var self = this;

		if (ajaxOptions != null && ajaxOptions.xmlRetrievalPath != null) {
			// Load document from the specified path
			$.ajax({
				type : "GET",
				url : ajaxOptions.xmlRetrievalPath,
				data : (ajaxOptions.xmlRetrievalParams),
				dataType : "text",
				success : function(data) {
					if ($(data).children().length) {
						self._documentReady(data);
					} else if (self.options.templateOptions.templatePath) {
						// Document path didn't retrieve anything
						self._templating();
					} else {
						console.error(self.options.i18n[self.options.userLang].noDocument);
					}
				}
			});
		} else if ($.trim(localXMLContent)) {
			// Use local content embedded in starting element next
			this._documentReady(localXMLContent);
		} else if (this.options.templateOptions.templatePath) {
			// Fall back to templating if it was specified
			this._templating();
		} else {
			console.error(self.options.i18n[self.options.userLang].noStartingDocument);
		}
	},

	loadVocabularies : function(vocabularyConfigs) {
		var self = this;
		this.loadingVocabs = 0;

		if (!this.options.vocabularyConfigs || !this.options.vocabularyConfigs.vocabularies) {
			return;
		}

		$.each(this.options.vocabularyConfigs.vocabularies, function(vocabName, vocabInfo) {
			if ("url" in vocabInfo) {
				self.loadingVocabs++;
			}
		});

		$.each(this.options.vocabularyConfigs.vocabularies, function(vocabName, vocabInfo) {
			if ("url" in vocabInfo) {
				$.ajax({
					url : vocabInfo["url"],
					type : "GET",
					dataType : "json"
				}).done(function(data){
					vocabInfo.values = data;
					self.loadingVocabs--;
					if (self.loadingVocabs == 0) {
						self._everythingReady();
					}
				});
			}
		});
	},

	_templating : function() {
		var dialog;
		var self = this;
		self.template = new XMLTemplates(self);

		self.template.createChooseTemplate();
	},

	// XML Document loaded event
	_documentReady : function(xmlString) {
		var self = this;

		this.xmlState = new DocumentState(xmlString, this);
		this.xmlState.extractNamespacePrefixes();
		this.undoHistory = new UndoHistory(this.xmlState, this);
		this.undoHistory.setStateChangeEvent(function() {
			self.refreshDisplay();
		});
		this._everythingReady();
	},
	
	// Schema object loaded event
	_schemaReady : function() {
		if (!this.options.targetNS) {
			this.targetNS = this.schema.namespace;
		}
		this.schemaTree = new SchemaTree(this.schema);
		this.schemaTree.build();
		this._everythingReady();
	},
	
	// Performs initialization of editor after rejoining document and schema loading workflows
	// to support asychronous/multithreaded loading 
	_everythingReady : function() {
		// Join back up asynchronous loading of document and schema
		if (!this.schemaTree || !this.xmlState || this.loadingVocabs != 0)
			return;

		this.targetPrefix = this.xmlState.namespaces.getNamespacePrefix(this.options.targetNS);
		
		this.constructEditor();
		this.refreshDisplay();
		this.activeEditor.selectRoot();
		this.modeChange(this.options.initialEditMode); // Optional initial source view change
		this.refreshDisplay();
		// Capture baseline undo state
		this.undoHistory.captureSnapshot();
	},
	
	// Construct user interface components of the editor
	constructEditor: function() {
		// Work Area
		this.xmlWorkAreaContainer = $("<div/>").attr('class', xmlWorkAreaContainerClass).appendTo(this.xmlEditorContainer);
		
		// Menu bar
		var editorHeaderBacking = $("<div/>").addClass(editorHeaderClass + "_backing").appendTo(this.xmlWorkAreaContainer);
		this.editorHeader = $("<div/>").attr('class', editorHeaderClass).appendTo(this.xmlWorkAreaContainer);
		if (this.options.documentTitle != null)
			$("<h2/>").html(this.options.i18n[this.options.userLang].editing + this.options.documentTitle).appendTo(this.editorHeader);
		this.menuBar.render(this.editorHeader);
		editorHeaderBacking.height(this.editorHeader.outerHeight());
		// Create grouping of header elements that need to be positioned together
		this.editorHeaderGroup = this.editorHeader.add(editorHeaderBacking);
		
		this.xmlTabContainer = $("<div/>").attr("class", editorTabAreaClass).css("padding-top", this.editorHeader.height() + "px").appendTo(this.xmlWorkAreaContainer);
		this.problemsPanel = $("<pre/>").attr('class', problemsPanelClass).hide().appendTo(this.xmlTabContainer);
		
		this.guiEditor.initialize(this.xmlTabContainer);
		this.modeChange(0);
		
		var self = this;
		$(window).resize($.proxy(this.resize, this));
		
		this.modifyMenu.initialize(this.xmlEditorContainer);
		this.modifyMenu.addMenu(addElementMenuClass, this.options.i18n[this.options.userLang].addSubelement, 
				true, false, true);
		this.modifyMenu.addAttributeMenu(addAttrMenuClass, this.options.i18n[this.options.userLang].addAttribute, 
				true, false, true);
		this.modifyMenu.addNodeMenu(addNodeMenuClass, this.options.i18n[this.options.userLang].addNodes, true, false);
		this.addTopLevelMenu = this.modifyMenu.addMenu(addTopMenuClass, this.options.i18n[this.options.userLang].addRoot, 
				true, true, false, function(target) {
			var selectedElement = self.guiEditor.selectedElement;
			if (!selectedElement || selectedElement.length == 0 || selectedElement.isRootElement) 
				return null;
			var currentElement = selectedElement;
			while (currentElement.parentElement != null) {
				if (currentElement.parentElement.isRootElement)
					break;
				currentElement = currentElement.parentElement;
			}
			if (currentElement != null)
				return currentElement;
			return null;
		}).populate(this.guiEditor.rootElement);
		
		this.setEnableKeybindings(this.options.enableGUIKeybindings);
		if (this.options.floatingMenu) {
			$(window).bind('scroll', $.proxy(this.modifyMenu.setMenuPosition, this.modifyMenu));
		}

		this.ready = true;
	},
	
	// Resize event for refreshing menu and editor sizes
	resize: function () {
		this.xmlTabContainer.width(this.xmlEditorContainer.outerWidth() - (this.modifyMenu.menuColumn != null ? this.modifyMenu.menuColumn.outerWidth() : 0));
		if (this.activeEditor != null){
			this.activeEditor.resize();
		}
		this.editorHeader.width(this.xmlTabContainer.width());
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
		if (!this.options.enableEdit && this.modifyMenu.menuColumn != null) { // no edit enabled => don't show modify menu
			this.modifyMenu.menuColumn.style.width = "0px";
		}
	},
	
	// Event which triggers the creation of a new child element, as defined by an instigator such as a menu
	addChildElementCallback: function (instigator, relativeTo, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;
		var xmlElement = $(instigator).data("xml").target;
		var objectType = $(instigator).data("xml").objectType;
		
		this.addChildElement(xmlElement, objectType, relativeTo, prepend);
	},

	addChildElement: function(parentElement, newElementDefinition, relativeTo, prepend) {
		if (!parentElement.allowChildren)
			return null;

		// If in the text editor view, synchronous the text to the xml model and ensure wellformedness
		if (this.textEditor.active) {
			if (this.xmlState.changesNotSynced()) {
				try {
					this.setXMLFromEditor();
				} catch (e) {
					this.addProblem(this.options.i18n[this.options.userLang].unableToAddFixSyntax, e);
					return;
				}
			}
		}

		var objectType;
		if (typeof newElementDefinition == 'string' || newElementDefinition instanceof String) {
			var defs = parentElement.objectType.elements;
			
			for (var index in defs)  {
				var definition = defs[index];
				var elementName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (elementName == newElementDefinition) {
					objectType = definition;
					break;
				}
			}

			// No matching child definition and parent doesn't allow "any", so can't add child
			if (!objectType && !parentElement.objectType.any) {
				return "Could not add child " + newElementDefinition + ", it is not a valid child of " + parentElement.objectType.localName;
			}
		} else {
			objectType = newElementDefinition;
		}

		// Create the new element as a child of its parent
		var newElement;
		if (objectType) {
			// Determine if it is valid to add this child element to the given parent element
			if (!parentElement.childCanBeAdded(objectType))
				return;
			
			// Add the namespace of the new element to the root if it is not already present
			this.xmlState.addNamespace(objectType);
			newElement = parentElement.addElement(objectType, relativeTo, prepend);
		} else {
			var nameParts = newElementDefinition.split(":");
			this.xmlState.addNamespace(nameParts.length > 1? nameParts[0] : "");
			newElement = parentElement.addNonschemaElement(newElementDefinition, relativeTo, prepend);
		}
		
		if (newElement == null) {
			return this.options.i18n[this.options.userLang].failedToAddChild + newElementDefinition;
		}
		
		// Trigger post element creation event in the currently active editor to handle UI updates
		this.activeEditor.addElementEvent(parentElement, newElement);

		return newElement;
	},
	
	// Event which adds an attribute to an element, as defined by an instigator such as a menu
	addAttributeButtonCallback: function(instigator) {
		if ($(instigator).hasClass("disabled"))
			return;
		// Create attribute on the targeted parent, and add its namespace if missing
		var data = $(instigator).data('xml');

		return this.addAttribute(data.target, data.objectType, instigator);
	},

	addAttribute: function(xmlElement, attrDefinition, instigator) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		var objectType;
		if ($.type(attrDefinition) === "object") {
			objectType = attrDefinition;
		} else {
			var defs = xmlElement.objectType.attributes;
			
			for (var index in defs)  {
				var definition = defs[index];
				var attrName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (attrName == attrDefinition) {
					objectType = definition;
					break;
				}
			}

			if (!objectType && !xmlElement.objectType.anyAttribute) {
				return this.options.i18n[this.options.userLang].couldNotAddAttr1 + attrDefinition + this.options.i18n[this.options.userLang].couldNotAddAttr2 + xmlElement.objectType.localName;
			}
		}

		var newAttr;
		if (objectType) {
			this.xmlState.addNamespace(objectType);
			newAttr = xmlElement.addAttribute(objectType);
		} else {
			var nameParts = attrDefinition.split(":");
			if (nameParts.length > 1)
				this.xmlState.addNamespace(nameParts[0]);
			newAttr = xmlElement.addAttribute({
				attribute : true,
				localName : attrDefinition
			});
			//newAttr = xmlElement.addNonschemaAttribute(newElementDefinition);
		}

		// Inform the active editor of the newly added attribute
		this.activeEditor.addAttributeEvent(xmlElement, newAttr, $(instigator));

		return newAttr;
	},

	addNodeCallback: function(instigator, nodeType, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;

		var data = $(instigator).data('xml');

		this.addNode(data.target, nodeType, prepend);
	},

	addNode: function(parentElement, nodeType, prepend, relativeTo) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		if (!(parentElement instanceof XMLElement)) {
			return;
		}

		// Create node on the targeted parent
		var nodeObject = parentElement.addNode(nodeType, prepend, relativeTo);
		// Inform the active editor of the newly added attribute
		if (nodeObject) {
			this.guiEditor.selectNode(nodeObject);
			this.activeEditor.addNodeEvent(parentElement, nodeObject);
			nodeObject.focus();
		}
	},

	// Adds an element stub either as a child of an element which allows children, or 
	// as a sibling
	addNextElement : function(xmlElement, prepend) {
		if (xmlElement.allowChildren) {
			this.addNode(xmlElement, "element", prepend);
		} else {
			this.addNode(xmlElement.parentElement, "element", prepend, xmlElement);
		}
	},

	// Triggered when a document has been loaded or reloaded
	documentLoadedEvent : function(newDocument) {
		if (this.guiEditor != null && this.guiEditor.rootElement != null)
			this.guiEditor.rootElement.xmlNode = newDocument.children().first();
		if (this.problemsPanel != null)
			this.clearProblemPanel();
	},
	
	// Switch the currently active editor to the editor identified
	modeChange: function(mode) {
		// Can't change mode to current mode
		if ((mode == 0 && this.guiEditor.active) || (mode == 1 && this.textEditor.active))
			return this;
			
		if (mode == 0) {
			$("*:focus").blur();
			$(".xml_editor_container *:focus").blur();

			if (this.textEditor.isInitialized() && this.xmlState.isChanged()) {
				// Try to reconstruct the xml object before changing tabs.
				this.setXMLFromEditor();
				this.undoHistory.captureSnapshot();
			}
		}
		
		$(".active_mode_tab").removeClass("active_mode_tab");
		this.modifyMenu.clearContextualMenus();
		if (this.activeEditor != null) {
			this.activeEditor.deactivate();
		}
		if (mode == 0) {
			this.activeEditor = this.guiEditor;
			var editor = this.activeEditor;
			setTimeout(function() {editor.selectNext();}, 200);
			$("#" + xmlMenuHeaderPrefix + this.options.i18n[this.options.userLang].xml.replace(/ /g, "_")).addClass("active_mode_tab");
		} else {
			this.activeEditor = this.textEditor;
			$("#" + xmlMenuHeaderPrefix + this.options.i18n[this.options.userLang].text.replace(/ /g, "_")).addClass("active_mode_tab");
		}
		this.activeEditor.activate();
		if (this.ready)
			this.resize();
		return this;
	},
	
	refreshDisplay: function() {
		if (this.activeEditor == null)
			return;
		this.activeEditor.refreshDisplay();
		
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
		try {
			if (this.modifyMenu.menuColumn != null) {
				this.xmlWorkAreaContainer.width(this.xmlEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
			}
		} catch(e) {
			console.log(e);
		}
	},
	
	setTextArea : function(xmlString) {
		if (this.isTextAreaEditor)
			this.element.val(xmlString);
	},
	
	// Refresh the state of the XML document from the contents of text editor 
	setXMLFromEditor: function() {
		var xmlString = this.textEditor.aceEditor.getValue();
		this.xmlState.setXMLFromString(xmlString);
		if (this.guiEditor.isActive) {
			this.guiEditor.setRootElement(this.xmlState.xml.children()[0]);
			this.addTopLevelMenu.populate(this.guiEditor.rootElement)
		}
	},
	
	getXMLString: function() {
		if (this.textEditor.active) {
			var xmlString = this.textEditor.aceEditor.getValue();
			try {
				this.xmlState.setXMLFromString(xmlString);
			} catch (e) {
				// Ignore error, continue to return last GUI value instead
			}
		}
		return this.xml2Str(this.xmlState.xml);
	},

	getText: function() {
		if (this.textEditor.active) {
			return this.textEditor.aceEditor.getValue();
		}
		return this.xml2Str(this.xmlState.xml);
	},

	// Callback for submit button pressing.  Performs a submit function and then uploads the 
	// document to the provided URL, if configured to do either
	submitXML: function(config) {
		if (config.onSubmit) {
			config.onSubmit.call(this, config);
		}

		if (config.url) {
			this.uploadXML(config);
		}
	},
	
	// Export the contents of the editor as text to a file, as supported by browsers
	exportXML: function() {
		if (typeof(Blob) === "undefined") {
			this.addProblem(this.options.i18n[this.options.userLang].noBrowserExportSupport);
			return false;
		}
		
		var exportDialog = $("<form><input type='text' class='xml_export_filename' placeholder='file.xml'/><input type='submit' value='" + this.options.i18n[this.options.userLang].export + "'/></form>")
				.dialog({modal: true, dialogClass: 'xml_dialog', resizable : false, title: this.options.i18n[this.options.userLang].filename, height: 80});
		var self = this;
		exportDialog.submit(function(){
			if (self.textEditor.active) {
				try {
					self.setXMLFromEditor();
				} catch (e) {
					self.xmlState.setDocumentHasChanged(true);
					$("." + submissionStatusClass).html(this.options.i18n[this.options.userLang].saveFailedSeeErrors).css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem(this.options.i18n[this.options.userLang].saveFailedXmlInvalid, e);
					return false;
				}
			}
			var xmlString = self.xml2Str(self.xmlState.xml);
			var blob = new Blob([xmlString], { type: "text/xml" }); 
			var url = URL.createObjectURL(blob);
			
			exportDialog.dialog('option', 'title', '');
			var fileName = exportDialog.find('input[type="text"]').val();
			if (!fileName)
				fileName = "file.xml";
			var download = $('<a>' + this.options.i18n[this.options.userLang].download + ' ' + fileName + '</a>').attr("href", url);
			download.attr("download", fileName);
			exportDialog.empty().append(download);
			return false;
		});
	},

	// Upload the contents of the editor to a path
	uploadXML: function(config) {
		if (!config || !config.url) {
			if (this.submitButtonConfigs.length > 0 && this.submitButtonConfigs[0].url) {
				config = this.submitButtonConfigs[0];
			} else {
				this.addProblem(this.options.i18n[this.options.userLang].cannotSubmitNoPostOption);
				return;
			}
		}

		$(':focus').blur(); // Ensure focus is removed before saving, so that finished content saved
		if (this.textEditor.active) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				this.xmlState.setDocumentHasChanged(true);
				$("." + submissionStatusClass).html(this.options.i18n[this.options.userLang].saveFailedSeeErrors).css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
				this.addProblem(this.options.i18n[this.options.userLang].saveFailedXmlInvalid, e);
				return false;
			}
		}
		// convert XML DOM to string
		var xmlString = this.xml2Str(this.xmlState.xml);
		$("." + submissionStatusClass).html(this.options.i18n[this.options.userLang].submitting);
		var self = this;
		$.ajax({
			url : config.url,
			contentType : "application/xml",
			type : "POST",
			data : xmlString,
			success : function(response) {
				// Process the response from the server using the provided response handler
				// If the result of the handler evaluates true, then it is assumed to be an error
				var outcome = config.responseHandler(response);

				if (!outcome) {
					self.xmlState.changesCommittedEvent();
					self.clearProblemPanel();
				} else {
					self.xmlState.syncedChangeEvent();
					$("." + submissionStatusClass).html(this.options.i18n[this.options.userLang].saveFailedSeeErrors).css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem(this.options.i18n[this.options.userLang].failedToSubmit, outcome);
				}
			},
			error : function(jqXHR, exception) {
				if (config.errorHandler) {
					config.errorHandler(jqXHR, exception);
					return;
				}

				self.options.submitErrorHandler(jqXHR, exception);
			}
		});
	},
	
	// Default server submission response parser, mostly for reference.  
	swordSubmitResponseHandler: function(response) {
		var responseObject = $(response);
		if (responseObject.length > 0 && localName(responseObject[responseObject.length - 1]) == "sword:error") {
			return responseObject.find("atom\\:summary").html();
		}
		return false;
	},

	// Serializes the provided xml node into a string
	xml2Str: function(xmlNodeObject) {
		if (xmlNodeObject == null)
			xmlNodeObject = this.xmlState.xml;
		var xmlNode = (xmlNodeObject instanceof jQuery? xmlNodeObject[0]: xmlNodeObject);
		var xmlStr = "";
		if (this.options.prettyXML) {
			return formatXML(xmlNode);
		} else {
			try {
				// Gecko-based browsers, Safari, Opera.
				return (new XMLSerializer()).serializeToString(xmlNode);
			} catch (e) {
				try {
					// Internet Explorer.
					return xmlNode.xml;
				} catch (e) {
					this.addProblem(this.options.i18n[this.options.userLang].xmlSerializerNotSupported, e);
					return false;
				}
			}
		}
	},
	
	// Add a error/problem message to the error display
	addProblem: function(message, problem) {
		this.problemsPanel.html(message + "<br/>");
		if (problem !== undefined) {
			if (problem.substring) {
				this.problemsPanel.append(problem.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			} else {
				this.problemsPanel.append(problem.message.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			}
		}
		console.error(problem);
		this.refreshProblemPanel();
	},
	
	// Clear the listing of errors
	clearProblemPanel: function() {
		this.problemsPanel.hide();
	},
	
	// Update whether or not the error panel is displayed
	refreshProblemPanel: function() {
		if (this.problemsPanel.html() == "") {
			this.problemsPanel.hide("fast");
		} else {
			this.problemsPanel.show("fast");
		}
	},

	// Performs an equality comparison between two nodes, returning true if they match namespace uri and element name
	nsEquals: function(node, element, elementNS) {
		if (element.substring)
			return element == localName(node) && elementNS == node.namespaceURI;
		return localName(element) == localName(node) && node.namespaceURI == element.namespace;
	},
	
	// Strips the namespace prefix off an element name
	stripPrefix: function(name) {
		var index = name.indexOf(":");
		return index == -1? name: name.substring(index + 1);
	},
	
	setEnableKeybindings : function(enable) {
		if (enable) {
			this.options.enableGUIKeybindings = true;
			if (this.menuBar.menuBarContainer) {
				this.menuBar.menuBarContainer.removeClass("xml_bindings_disabled");
			}
			$(window).on("keydown.xml_keybindings", $.proxy(this.keydownCallback, this));
		} else {
			this.options.enableGUIKeybindings = false;
			if (this.menuBar.menuBarContainer) {
				this.menuBar.menuBarContainer.addClass("xml_bindings_disabled");
			}
			$(window).off("keydown.xml_keybindings");
		}
	},

	getFocusedInput: function() {
		return $("input:focus, textarea:focus, select:focus");
	},
	
	// Initialize key bindings
	keydownCallback: function(e) {
		var prepend = this.options.prependNewElements ^ e.shiftKey;

		if (this.guiEditor.active) {
			var focused = this.getFocusedInput();
			
			// Escape key, blur the currently selected input or deselect selected element
			if (e.which == 27) {
				if (focused.length > 0) {
					focused.blur();
				} else this.guiEditor.selectNode(null);
				return false;
			}
			
			// Tab, select the next input
			if (e.which == 9) {
				e.preventDefault();
				this.guiEditor.focusInput(e.shiftKey);
				return false;
			}
			
			// Delete key press while item selected but nothing is focused.
			if (e.which == 46 && focused.length == 0) {
				this.guiEditor.deleteSelected();
				return false;
			}
			
			if (e.which > 36 && e.which < 41){
				if (e.altKey && (focused.length == 0 || focused.is("textarea"))) {
					e.preventDefault();
					// Alt + up or down move the element up and down in the document
					this.guiEditor.moveSelected(e.which == 38);
					if (focused.is("textarea"))
						focused.focus();
					return false;
				}
				if (focused.length == 0) {
					e.preventDefault();
					if (e.shiftKey) {
						// If holding shift while pressing up or down, then jump to the next/prev sibling
						if (e.which == 40 || e.which == 38) {
							this.guiEditor.selectSibling(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectParent(e.which == 39);
						}
					} else {
						// If not holding shift while hitting up or down, go to the next/prev element
						if (e.which == 40 || e.which == 38){
							this.guiEditor.selectNext(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectAttribute(e.which == 37);
						}
					}
				}
				return true;
			}
			
			if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Z'.charCodeAt(0)) {
				// Undo
				this.undoHistory.changeHead(e.shiftKey? 1: -1);
				return false;
			} else if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Y'.charCodeAt(0)){
				// Redo
				this.undoHistory.changeHead(1);
				return false;
			}
		}
		
		if (e.altKey && e.ctrlKey) {
			// Save, on either tab.
			if (e.which == 'S'.charCodeAt(0)) {
				$("." + submitButtonClass).click();
				return false;
			}
			
			if (e.which == 'E'.charCodeAt(0)) {
				this.exportXML();
				return false;
			}
			
			// Switch to the GUI editor
			if (e.which == '1'.charCodeAt(0)) {
				this.modeChange(0);
				return false;
			}
			
			// Switch to the text editor
			if (e.which == '2'.charCodeAt(0)) {
				this.modeChange(1);
				return false;
			}
		}

		if (this.guiEditor.active) {
			var selected = this.guiEditor.selectedElement;

			// Enter, contextual adding
			if (e.which == 13) {
				var focused = this.getFocusedInput();
				if (focused.length == 0 || e.altKey) {
					if (selected instanceof XMLElement) {
						this.addNextElement(selected, e.shiftKey);
					} else if (selected instanceof XMLElementStub 
							|| selected instanceof XMLAttributeStub) {
						selected.create();
					}
					e.preventDefault();
					return false;
				}
				return true;
			}

			if (e.altKey) {
				if (e.which == 'E'.charCodeAt(0)) {
					if (selected instanceof XMLElement && selected.allowChildren)
						this.addNode(selected, "element", prepend);
					return false;
				}

				if (e.which == 'S'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected.parentElement, "element", prepend, selected);
					return false;
				}

				if (e.which == 'P'.charCodeAt(0)) {
					if (selected && selected.parentElement.objectType)
						this.addNode(selected.parentElement, "element", prepend);
					return false;
				}

				if (e.which == 'R'.charCodeAt(0)) {
					this.addNode(this.guiEditor.rootElement, "element", prepend);
					return false;
				}

				if (e.which == 'A'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "attribute", prepend);
					return false;
				}

				if (e.which == 'T'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "text", prepend);
					return false;
				}

				if (e.which == 191) {
					if (selected)
						this.addNode(selected, "comment", prepend);
					return false;
				}

				if (e.which == 188) {
					if (selected)
						this.addNode(selected, "cdata", prepend);
					return false;
				}
			}
		}
		
		return true;
	},
	
	// Menu Update functions
	refreshMenuUndo: function(self) {
		if (self.undoHistory.headIndex > 0) {
			$("#" + xmlMenuHeaderPrefix + self.options.i18n[self.options.userLang].undoMenuitem.replaceAll(' ','_')).removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + self.options.i18n[self.options.userLang].undoMenuitem.replaceAll(' ','_')).addClass("disabled").data("menuItemData").enabled = false;
		}
		if (self.undoHistory.headIndex < self.undoHistory.states.length - 1) {
			$("#" + xmlMenuHeaderPrefix + self.options.i18n[self.options.userLang].redoMenuitem.replaceAll(' ','_')).removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + self.options.i18n[self.options.userLang].redoMenuitem.replaceAll(' ','_')).addClass("disabled").data("menuItemData").enabled = false;
		}
	},
	
	// Performs updates to the menu for changing element/attribute selection
	refreshMenuSelected: function(self) {
		var suffixes = [self.options.i18n[self.options.userLang].deselect.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].nextElement.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].previousElement.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].parentElement.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].firstChild.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].nextSibling.replaceAll(' ','_'),
						self.options.i18n[self.options.userLang].previousSibling.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].nextAttribute.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].previousAttribute.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].deleteElement.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].moveElementUp.replaceAll(' ','_'), 
						self.options.i18n[self.options.userLang].moveElementDown.replaceAll(' ','_')];
		var hasSelected = self.guiEditor.selectedElement != null && self.guiEditor.active;
		$.each(suffixes, function(){
			if (hasSelected)
				$("#" + xmlMenuHeaderPrefix + this.toString()).removeClass("disabled").data("menuItemData").enabled = true;
			else $("#" + xmlMenuHeaderPrefix + this.toString()).addClass("disabled").data("menuItemData").enabled = false;
		});
	},

	// Finds the associated vocabulary for an xml element
	getVocabulary: function(xmlElement) {
		if (!this.options.vocabularyConfigs) {
			return null;
		}
		var self = this;
		var matchingVocab = null;
		var xmlDocument = this.xmlState.xml;
		if (this.options.vocabularyConfigs.cssSelectors) {
			$.each(this.options.vocabularyConfigs.cssSelectors, function(selector, vocabulary){
				// find elements in xml document that match this vocabulary's selector
				var matches = $(selector, xmlDocument);

				// Check to see if our xmlElement was in the matching list
				for (var i = 0; i < matches.length; i++) {
					if (xmlElement.xmlNode[0] === matches[i]) {
						matchingVocab = vocabulary;
						return false;
					}
				}
			});
		}

		var nsResolver = function nsResolver(prefix) {
			return self.options.vocabularyConfigs.xpathNamespaces[prefix] || null;
		};
		nsResolver.lookupNamespaceURI = nsResolver;

		if (this.options.vocabularyConfigs.xpathSelectors) {
			$.each(this.options.vocabularyConfigs.xpathSelectors, function(selector, vocabulary){
				// find elements in xml document that match this vocabulary's selector
				var matchesIterate = xmlDocument[0].evaluate(selector, xmlDocument[0], nsResolver, null, null);

				// Check to see if our xmlElement was in the matching 0list
				var match = matchesIterate.iterateNext()
				while (match) {
					if (xmlElement.xmlNode[0] === match) {
						matchingVocab = vocabulary;
						return false;
					}
					match = matchesIterate.iterateNext();
				}
			});
		}

		if (!matchingVocab || !(matchingVocab in this.options.vocabularyConfigs.vocabularies)) {
			return null;
		}

		return this.options.vocabularyConfigs.vocabularies[matchingVocab];	
	}
});
