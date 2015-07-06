/**
 * Create class to select and load default XML templates
 * @param init_object
 * @constructor
 */
function XMLTemplates(init_object) {
    this.template_path = init_object.options.templatePath;
    this.templates = init_object.options.templates;
    this.editor = init_object;
}

XMLTemplates.prototype.constructor = XMLTemplates;

/**
 * Load the dialog form for user to select a template from a list of provided templates
 */
XMLTemplates.prototype.createDialog = function() {
    var self = this,
        dialog, form;

    dialog = $("#dialog-form").dialog({
        autoOpen: true,
        dialogClass: "no-close",
        height: 350,
        width: 500,
        modal: true,
        buttons: {
            "Select Template": function() { self.processForm($(this), self); },
            Cancel: function() {
                $(this).dialog("close");

                var default_template = self.editor.options.cancelTemplate;

                if(default_template) {
                    self.loadSelectedTemplate(default_template, self);
                } else {
                   self.editor.loadSchema(self.editor.options.schema);
                }
            }
        },
        close: function() {
            form[0].reset();
            $([]).add(self.selected).removeClass("ui-state-error");
        }
    });

    form = dialog.find("form").on("submit", function(e) {
        e.preventDefault();
    });
};

/**
 * Create form & add to DOM
 * Don't think we can assume user will build this form themselves
 */
XMLTemplates.prototype.templateForm = function() {
    var form = '<div id="dialog-form" title="Please Select a Template">' +
      '<p class="validateTips">Form field is required.</p>' +
      '<form>' +
        '<fieldset>';
    for(var i=0; i<this.templates.length; i++) {
        form += '<input class="templating" name="templating" type="radio" value="' + this.templates[i] + '">' + this.templates[i] + '<br />';
    }

    form += '<input type="submit" tabindex="-1" style="position:absolute; top:-1000px">' +
       '</fieldset>' +
      '</form>' +
    '</div>';

    $(form).insertAfter("body");
};

/**
 * Select a template from the form
 * @param dialog
 * @param self
 * @returns {boolean}
 */
XMLTemplates.prototype.processForm = function(dialog, self) {
    var valid = true;
    var selected = $(".validateTips");
    var selection = $("input[name=templating]:checked").val();

    selected.removeClass("ui-state-error");

    if (selection === undefined) {
        valid = false;
        selected.addClass("ui-state-error").css("display", "block");
    } else {
        $(dialog).dialog("close");
        self.loadSelectedTemplate(selection, self);
    }

    return valid;
};

/**
 * Load selected template.
 * @param selection
 * @param self
 */
XMLTemplates.prototype.loadSelectedTemplate = function(selection, self) {
    // Default template loading doesn't have access to xml_templates constructor
    if(self.editor === undefined) { self.editor = self; }

    $.ajax({
        url: this.template_path + selection,
        dataType: "xml"
    }).done(function(data) {
        var xml_string = self.editor.xml2Str(data);
        self.editor._documentReady(xml_string);
        self.editor.loadSchema(self.editor.options.schema);
    }).fail(function(jqXHR, textStatus) {
        self.editor.loadSchema(self.editor.options.schema);
        alert("Unable to load the requested template: " + textStatus);
    });
};