/*global define, brackets, $ */

/**
 * Provides phplint results via the core linting extension point
 */
define(function (require, exports, module) {
    "use strict";

    var AppInit              = brackets.getModule("utils/AppInit");
    var DocumentManager      = brackets.getModule('document/DocumentManager');
    var CodeInspection       = brackets.getModule("language/CodeInspection");
    var EditorManager        = brackets.getModule('editor/EditorManager');
    var NodeConnection       = brackets.getModule('utils/NodeConnection');
    var Dialogs              = brackets.getModule("widgets/Dialogs");
    var ExtensionUtils       = brackets.getModule('utils/ExtensionUtils');
    var node                 = new NodeConnection();
    var codeInspectionErrors = [];
    
    ExtensionUtils.loadStyleSheet(module, "css/style.css");
    
    if (!node.domains.phplint) {
        node.connect(true).done(function () {
            var path = ExtensionUtils.getModulePath(module, 'node/commander.js');
            node.loadDomains([path], true).done(function () {
                AppInit.appReady(initLinter);
            });
        });
    } else {
        AppInit.appReady(initLinter);
    }
    
    function initLinter() {
        $(EditorManager).on('activeEditorChange', function (event, EditorManager) {
            var currentDocument = DocumentManager.getCurrentDocument();
            var codeMirror;
            
            if(currentDocument.language._name == 'PHP') {
                codeMirror = registerGutter();
                analizeErrors(codeMirror, currentDocument.file._path);
                
                $(DocumentManager).on('documentSaved', function () {
                    analizeErrors(codeMirror, currentDocument.file._path);
                });
            } else {
                $(DocumentManager).off('documentSaved');
            }
        });
        
        CodeInspection.register("php", {
            name: "PHPLint",
            scanFile: function (text, fullPath) {
                return {
                    errors: codeInspectionErrors
                };
            }
        });
    }
    
    function analizeErrors(codeMirror, filePath) {
        getLintErrors(filePath, function (error) {
            if(error) {
                addError(codeMirror, error);
            } else {
                codeMirror.clearGutter("interactive-php-linter-gutter");
            }
        });
    }
    
    function registerGutter() {
        
        var currentEditor = EditorManager.getActiveEditor();
        var codeMirror = currentEditor._codeMirror;
        var gutters = codeMirror.getOption("gutters").slice(0);
        if (gutters.indexOf("interactive-php-linter-gutter") === -1) {
            gutters.unshift("interactive-php-linter-gutter");
            codeMirror.setOption("gutters", gutters);
        }
        
        return codeMirror;
        
    }
    
    function addError(cm, error) {
        var element = $("<div class='interactive-php-linter-gutter-icon' title='Click for details'>&nbsp;</div>");
        element.click(function() {
            Dialogs.showModalDialog(
                "phpLinterModal",
                "PHP Error",
                error.message
            );
        });
        cm.setGutterMarker(error.line, "interactive-php-linter-gutter", element[0]);
    }
    
    function getLintErrors(filePath, callback) {
        var error = false;
        node.domains.phplint.commander('php -d display_errors=1 -d error_reporting=-1 -l "' + filePath + '"').done(function (data) {
            if (data.indexOf('No syntax errors detected') === -1) {
                var match = /(.+) in (.+) on line (\d+)/.exec(data);
                var line = parseInt(match[3], 10) - 1;
                var message = match[1];
                
                error = {
                    line: line,
                    message: message,
                };
                
                codeInspectionErrors = [{
                    pos: {
                        line: line
                    },
                    message: message,
                    type: CodeInspection.Type.ERROR
                }];
            }
            CodeInspection.requestRun();
            callback(error);
        });
    }
    
});
