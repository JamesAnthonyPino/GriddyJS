/**
 * Griddy - a dynamic, sortable, editable, configurable, scrollable, skin-able table widget with selectable and delete-able rows.
 * 
 * Note: This is a fork of a previous table widget called DataTable with lots of improvements and enhancements.
 * 
 * See Griddy.txt for change log and other info
 * 
 * @author James Pino
 * @version 1.0
 * @param {type} cfg
 * @returns {Griddy}
 */
var Griddy = function(cfg) {
   
    // PRIVATE GLOBALS -----------------------------------------
    /*private*/var SELF = this, // global reference to this widget
                CFG = cfg,
                TABLE, 
                HEADER, 
                TBODY, 
                THEAD,
                TOOLBAR_THEAD,ROWS = [],
                ADDED_ROWS = [],
                DB,
                IS_SCROLLABLE = false,
                SELECT_ALL_CBOX,
                ROW_CBOXES = [],
                CURR_SORT_COL,
                CURR_SORT_DIR,
                ORIGINAL_DATA,
                NO_DATA_MSG,
                ON_SORT_CALLBACK,
                ON_READY_CALLBACK,    
                ON_ADD_ROW_CALLBACK,
                ON_CHANGE_CALLBACK,
                ON_READY_CALLBACK_CALLED = false,       
                ROWS_PER_PAGE,    
                FIRST_BUTTON, PREV_BUTTON, NEXT_BUTTON, LAST_BUTTON, PAGE_JUMP_INPUT, PAGE_JUMP_BUTTON,
                PAGE_FIND_INPUT, PAGE_FIND_BUTTON, PAGE_TEXT_SPAN, ROW_TEXT_SPAN,       
                TARGET,   
                ASC_SORT_BUTTONS = [],
                DESC_SORT_BUTTONS = [],
                DESC_ACTIVE_SORT_BUTTONS = [],
                ASC_ACTIVE_SORT_BUTTONS = [],
                EDIT_MODE = false;
    
    
    // PUBLIC GLOBALS -----------------------------------------
    /*public*/this.ID = [];
    /*public*/this.ERROR_LOG = [];
      
    
   /**
    * init - initializes widget, does any necessary preliminary work before rendering the
    * table.        
    */ 
   /*public*/this.init = function() {    

		var errMsg;
       
       // make a random ID if one was not passed in
       if(_getCfgProp("id")) {
           SELF.ID = "__GriddyGrid__" +  CFG.id;
       } else {
           SELF.ID = "__GriddyGrid__" +  _getRandomId();
       }
       
       
       if(_getCfgProp("noDataMsg")) {
           NO_DATA_MSG = _getCfgProp("noDataMsg");
       } else {
           NO_DATA_MSG = "No rows to display.";
       }

       if(typeof TAFFY === "undefined") {
           errMsg = "ERROR: The Griddy widget requires TaffyDB (taffy-min.js). \n" +
                "Please include this as a resource in your application.";
           _log(errMsg);
           
           // this is a critical error, application cannot continue
           throw(errMsg);           
        }
        
        if(typeof $ === "undefined") {
           errMsg = "ERROR: The Griddy widget requires jQuery 1.10+. \n" +
                "Please include this as a resource in your application.";
           _log(errMsg);
           
           // this is a critical error, application cannot continue
           throw(errMsg);           
        }
       
       
       _prepareData();                                  
       _render();
              
       if(_getCfgProp("scrollable")) {
           SELF.makeScrollable();
       }
       
       
       
       if(_getCfgProp("defaultSort")) {
            _doDefaultSort();
       }                                
       
   };
   
   
    /*private*/var _doDefaultSort = function() {
        
        var defaultSort = _getCfgProp("defaultSort");
        
        var byWhat, dir, dataType, header;
        
        if(defaultSort.hasOwnProperty("id")) {            
            
            byWhat = defaultSort.id;
            
            if(defaultSort.hasOwnProperty("direction") && defaultSort.direction.match(/ascending|descending/i)) {
                dir = defaultSort.direction;
            } else {
                dir = "ascending";
            }
                                    
            // search for the header with this ID
            $.each(CFG.data.headers, function(k,v) {                
                if(defaultSort.id === v.sortId) {
                    header = v;
                    return;
                }
            });
                                    
            dataType = _getDataType(header);                        
            
            // actually do the sort
            SELF.sort(byWhat, dir, dataType);
            
        }
           
   };
   
   
   /**
    * Prepare the raw data for consumption by the widget
    */
   /*private*/var _prepareData = function() {
	   
	   var dataType, header, v, v2, cellValue;
       
       // If row data is a real JSON string, convert to an object literal
       if(typeof CFG.data.rows === "string") {
           CFG.data.rows = $.parseJSON(CFG.data.rows);
       }
              
       // create an initial copy of the data for preservation
       // if the data needs to be reset        
        ORIGINAL_DATA = $.extend(true,[],CFG.data.rows);
                 
        var i,y;
        for(i=0; i<ORIGINAL_DATA.length; i++) {
            v = ORIGINAL_DATA[i];            
            var keys = [];
            for (var key in v) {      
                if (v.hasOwnProperty(key)) keys.push(key);
            }                        
        }
        
        for(i=0; i<ORIGINAL_DATA.length; i++) {
            v = ORIGINAL_DATA[i];                        
            for(y=0;y<keys.length;y++) {                
                header = CFG.data.headers[y];
                dataType = _getDataType(header);
                
                
                v2 = v[keys[y]];                                
                
                
                // get the value of the "cell" by determining if it's in the "value"
                // property of an object, or if just a plain string
                if(typeof v2 === "object" && v2 !== null && v2.hasOwnProperty("value")) {
                    cellValue = v2.value;
                } else {
                    cellValue = v2;
                }
                
                
                // get the sort value. If it's a date type, use the string value
                if(dataType !== null && dataType.type === "date") {                    
                            
                   if(cellValue === "null") {cellValue = "";}
                   
                   var date = new Date(_nullAsString(cellValue));                   
                   
                   if(date.toString().match(/Invalid Date|NaN/i)) {                    
                        //_log('"' + cellValue + '" is an invalid Date and may cause issues with sorting. The required format is yyyy/mm/dd hh:mm:ss');
                        // just use the original value
                        date = _nullAsString(cellValue);
                    }                    
                                        
                    v["__sortField__"+keys[y]] = date;                    
                } else {
                    v["__sortField__"+keys[y]] = _getSortValue(cellValue);
                }

                
            }                                  
        }
        
               
       // create a Taffy DB instance from the data        
       DB = TAFFY(ORIGINAL_DATA);
       
        // reset the array if it was previously populated
        ROWS.length = 0;
               
        DB().each(
         function(r) {
             ROWS.push(r);            
         }
        );


        // Do an integrity check to make sure all rows have the same number of columns
        var colCntReg = [];
        $.each(ROWS, function(k,v) {
            var c = 0;
            $.each(v, function(k2,v2){c++;});            
            colCntReg.push(c);
        });                
                
        for(i = 0;i<colCntReg.length;i++) {         
          if(i+1 < colCntReg.length) {
            if(colCntReg[i] !== colCntReg[i+1]) {
                throw "Fatal error: Row data integrity check failed on row number "+i+ ". " +
                "Make sure all rows have the same number of columns in your JSON data.";                
            }
          }
        }        

   };
      
   
   /**
    * _render - uses JSON data to render the table cells
    */
   /*private*/var _render = function() {
     
     TABLE = $("<table></table>");
     THEAD = $("<thead></thead>");
     
     TBODY = $("<tbody></tbody>");
          
     
    // render regular toolbar   
    if(_getCfgProp("showToolbar")) {
            _renderToolbar();        
     }
       
    // render the navigation toolbar
    if(_getCfgProp("tableNavigation")) {
        _renderHeader();        
     }
     
     
     TABLE.id = SELF.ID;
     if(_getCfgProp("border")) $(TABLE).attr("border", CFG.border);
     if(_getCfgProp("cssStyle"))$(TABLE).attr("style", CFG.cssStyle);     
     
     
     // Use the provided CSS class, otherwise use the
     // default class "Griddy" as specified in the inlcluded
     // Griddy.css (if present).
     if(_getCfgProp("cssClass") !== false) {
         $(TABLE).attr("class", CFG.cssClass);
     } else {
         $(TABLE).attr("class", "Griddy");
     }
     
     var tr = $("<tr></tr>");
     $(tr).appendTo(THEAD);     
     $(THEAD).appendTo(TABLE);     
     
     ROW_CBOXES.length = 0;
     
     if(_getCfgProp("selectableRows")) {
         var selectAllTh = $("<th></th>");
         SELECT_ALL_CBOX = $("<input type='checkbox'>");
         $(SELECT_ALL_CBOX).appendTo(selectAllTh);         
         $(selectAllTh).css("width", "1px");
         $(selectAllTh).css("text-align", "center");
         $(selectAllTh).appendTo(tr);         
         $(selectAllTh).click(function(){SELF.selectAllRows();});
     }

    if(_getCfgProp("showRowNums")) {        
        
        var rowNumLabel = _getCfgProp("rowNumLabel") || "#";
        
        var rowNumTh = $("<th>" + rowNumLabel + "</th>");
        $(rowNumTh).appendTo(tr);                                    
     }
     
     
     $.each(CFG.data.headers, function(k,v){
         var th = $("<th></th>");       
         
         $(th).attr("data-row-name", v.sortId);
         
         if(v.sortable) {        
             
             var baseId = SELF.ID + "_sortButton_" + v.sortId;
             
             var ascSortBtn = $("<input type='button' title='Sort ascending' class='ascSortButton'>");  
             $(ascSortBtn).prop("id",+baseId + "_ascending");
             
             $(ascSortBtn).click(function(){
                 var dt = _getDataType(v);                
                 SELF.sort(v.sortId, "ascending", dt);                 
                 
                 _resetSortIndicators();
                 
                 $(ascSortBtn).hide();
                 $(ascActiveSortBtn).show();                 
                 
                 $(SELECT_ALL_CBOX).prop("checked", false);
             });
             
             var descSortBtn = $("<input type='button' class='descSortButton' title='Sort descending'>");
             $(descSortBtn).prop("id", baseId + "_descending");
             
             $(descSortBtn).click(function(){                 
                 var dt = _getDataType(v);
                 SELF.sort(v.sortId, "descending", dt);                                  
                 
                 _resetSortIndicators();                 
                 
                 $(descSortBtn).hide();
                 $(descActiveSortBtn).show();
                 
                 $(SELECT_ALL_CBOX).prop("checked", false);
             });
             
             var descActiveSortBtn = $("<input type='button' class='descActiveSortButton'>");
             $(descActiveSortBtn).css("display", "none");
             $(descActiveSortBtn).prop("id", baseId + "_activeDescending");             
             $(descActiveSortBtn).prop("title", "Currently sorted descending on this column");    
             
             
             var ascActiveSortBtn = $("<input type='button' class='ascActiveSortButton'>");
             $(ascActiveSortBtn).prop("id", baseId + "_activeAscending");
             
             $(ascActiveSortBtn).prop("title", "Currently sorted ascending on this column");
             $(ascActiveSortBtn).css("display", "none");
             
             
             var tableDiv = $("<div class='tableDiv'>");
             var divLeft = $("<div class='divLeft'>" + v.title + "</div>");
             var divRight = $("<div class='divRight'>");
             var divRightTop = $("<div class='divRightTop'>");
             var divRightBottom = $("<div class='divRightBottom'>");
             
             $(tableDiv).append(divLeft);
                          
             if(_getCfgProp("emptyGrid") === false || _getCfgProp("editable") === true) {
                $(tableDiv).append(divRight);
                $(divRight).append(divRightTop);
                $(divRight).append(divRightBottom);
             }
             
                          
             $(ascSortBtn).appendTo(divRightTop);
             $(ascActiveSortBtn).appendTo(divRightTop);
             $(descSortBtn).appendTo(divRightBottom);
             $(descActiveSortBtn).appendTo(divRightBottom);
                          
             $(th).append(tableDiv);
                                                    
             ASC_SORT_BUTTONS.push(ascSortBtn);
             DESC_SORT_BUTTONS.push(descSortBtn);
             DESC_ACTIVE_SORT_BUTTONS.push(descActiveSortBtn);
             ASC_ACTIVE_SORT_BUTTONS.push(ascActiveSortBtn);
             
         } else {             
             $(th).append(v.title);
         }
         
         $(th).appendTo(tr);         
     });
               
     _renderTbody();

     $(TBODY).appendTo(TABLE);     
     TARGET = $("#"+CFG.targetNode);
     $(TABLE).appendTo(TARGET);     
   };
   
   
   /**
    * _renderTbody - render all the rows
    */
   /*private*/var _renderTbody = function() {        
       
       
       
       if(_getCfgProp("emptyGrid")) {
                                 
           ROWS = [];                      
           var i = parseInt(_getCfgProp("emptyGridRows") || 3);           
           
           while(i--) {               
                var emptyRow = {};
                $.each(CFG.data.headers, function(k,v){                                                  
                    emptyRow[v.sortId] = "";
                });               
                ROWS.push(emptyRow);
           }           
           CFG.editable = true;
       }
       
       
       if(typeof ROWS === "object" && ROWS.length === 0) {
           var colspan = $(THEAD).find("th").length;
           $("<tr class='even'><td colspan='"+colspan+"'>"+ NO_DATA_MSG +"</td></tr>").appendTo(TBODY);           
           return;
       }
       
       $.each(ROWS, function(k,v){
         var oddEven = k % 2 === 0 ? "even" : "odd";
         var rowNum = k + 1;
         
         var tr = $("<tr class='"+oddEven+"'></tr>");         
         
         if(_getCfgProp("selectableRows") && _getCfgProp("emptyGrid") === false) {
            
            var selectRowTd = $("<td></td>");    
            var selectRowCbox = $("<input type='checkbox'>");            
            
            $(selectRowCbox).click(function(e){                                                
                v.___selected = e.target.checked;                                                
            });
            
            ROW_CBOXES.push(selectRowCbox);
            $(selectRowCbox).appendTo(selectRowTd);            
            $(selectRowTd).css("text-align", "center");            
            $(selectRowTd).appendTo(tr);
         }
         
         
         // ROW NUMBERS
         if(_getCfgProp("showRowNums")) {
            var rowNumberTd = $("<td data-row-num='"+rowNum+"'>" + rowNum + "</td>");
            $(rowNumberTd).appendTo(tr);                                    
         }
         
         
         v.___selected = false;
                  
         var cnt = 0;
         $.each(v, function(k2,v2){         
             // ignore any property that is prefixed with a double underscore - this
             // is one way to hide undesired columns
             if(k2.match(/^__/)) return;
            
             var header = CFG.data.headers[cnt];
             var dataType = _getDataType(header);               
             var fieldType = _getFieldType(header);             
             var editableCell = _isEditableCell(header);                          
                          
             var td = $("<td></td>");
             $(td).attr("data-row-name", header.sortId);
             
             
             var cellValue;
             
             if(typeof v2 === "object" && v2 !== null) {
                 if(v2.hasOwnProperty("value")) {
                     cellValue = _getDtValue( _gracefulNull( v2.value ), dataType);
                 }
             } else {
                 cellValue = _getDtValue( _gracefulNull( v2 ), dataType);
             }
                                       
                                       
            // If the value is actually an object with a "link" property, render it as a link
            // with the "value" property as the link text. If there's an "onclick" property,
            // call the function when clicked on. **NOTE**: If the table is in edit mode,
            // this cell will NOT be rendered as editable.
            if(typeof v2 === "object" && v2 !== null && v2.hasOwnProperty("link")) {
                
                var link = $("<a href='"+v2.link+"'>" + _gracefulNull(v2.value) + "</a>");                
                if(v2.hasOwnProperty("onclick") && typeof v2.onclick === "function") {
                    $(link).click(function(){v2.onclick.call();});
                }                    
                $(link).appendTo(td);
                                
            // If the value is just a plain scalar (not an object or function), render the cell
            // with the plain value. If the table is in edit mode, render the value inside a
            // textbox.
            } else {
                if(_getCfgProp("editable") && editableCell) {
                        
                    var inputElement;                                            
                    
                    if(fieldType.type === "checkbox") {                        
                        inputElement = $("<input type='checkbox' class='editableValue'>");
                        
                        
                        
                        var checkedValue = false;
                        if(cellValue.match(/y|yes|t|true|1|checked/i)) {
                            checkedValue = _getBoolean(cellValue);
                        }                        
                                                 
                        
                        // check/uncheck the checkbox
                        $(inputElement).prop("checked", checkedValue);
                         
                        $(inputElement).change(function(e){
                            // change the value in the internal DB                            
                            v[k2] = String($(e.target).is(":checked"));
                        });                                                
                        
                    } else if(fieldType.type === "radio") {
                        inputElement = $("<input type='radio' class='editableValue'>");
                        $(inputElement).change(function(e){
                            // change the value in the DB                            
                            v[k2] = e.target.checked;
                        });                        
                        inputElement.checked = cellValue;
                    } else if(fieldType.type === "select") {
                        inputElement = $("<select class='editableValue'></select>");
                        $(inputElement).change(function(e){
                            // change the value in the DB                            
                            v[k2] = e.target.value;
                        });                        
                        inputElement.checked = cellValue;
                    } else {
                        inputElement = $("<input type='text' class='editableValue'>");       
                        
                        // Add the "modified" class when the textbox changes value (defined in the CSS)
                        $(inputElement).change(function(){                            
                            $(this).addClass("modified");
                        });
                        
                        // populate the value of the text input unless it's an empty grid
                        if(! _getCfgProp("emptyGrid")) {
                            $(inputElement).val(cellValue);
                        }
                        
                        // Add the mask if the plugin exists                        
                        if(dataType !== null && dataType.hasOwnProperty("mask") && $.fn.mask !== "undefined") {                                                                                   
                            if(! _isEmptyString(dataType.mask)) {
                                $(inputElement).mask(dataType.mask);
                            }
                        }
                        
                        
                         $(inputElement).change(function(e){
                            // change the value in the DB
                            v[k2] = e.target.value;
                         });
                                                                        
                        
                    }
                    
                    // Add error styling, if applicable
                    if(v2 !== null && v2.hasOwnProperty("error")) {                        
                        if(_getBoolean(v2.error)){
                            $(inputElement).addClass("editableValueError"); 
                        }
                    }
                    
                    // add a unique ID to this field
                    inputElement.id = SELF.ID + "_row" + rowNum + "_" + header.sortId;
                    
                    $(inputElement).attr("data-column-ref-id", header.sortId);
                    
                    
                    // add the input to the cell
                    $(inputElement).appendTo(td);
                } else {
                   // just place the plain text in the cell                                      
                   $(td).append(cellValue);                   
                }
                
                // finally, add the extra HTML to the cell, if it exists.
                if(v2 !== null && v2.hasOwnProperty("extraHtml")) {
                    var extraHtml = $(v2.extraHtml);
                    $(extraHtml).appendTo(td);
                }

            }
                                                                    
            $(td).appendTo(tr);
            
            cnt +=1;
         });
         $(tr).appendTo(TBODY);        
     });
     
     
     if(_getCfgProp("editable")) {
        _hideAllSortButtons();
     }
     
     if(ON_READY_CALLBACK_CALLED === false) {
         _onReady();
     }
     
   };
   
   
   /**
    * _renderToolbar - render the "regualr" toolbar  - a flexible area where
    * buttons can be placed.
    * 
    * @returns {undefined}
    */
   /*private void*/ var _renderToolbar = function() {
       
       
       var cols = CFG.data.headers.length;
       if(_getCfgProp("selectableRows")) {
           cols += 1;
       }
       
       if(_getCfgProp("showRowNums")) {
           cols += 1;
       }
       
       if(typeof TOOLBAR_THEAD !== "undefined") {
           $(TOOLBAR_THEAD).remove();           
       }
       
       TOOLBAR_THEAD = $("<thead class='header'><tr></tr></thead>");
       var th = $("<th colspan='"+cols+"'></th>");
       
       var tableToolbarDiv = $("<div class='tableToolBar'></div>");
       var leftDiv = $("<div class='left'></div>");
       var centerDiv = $("<div class='center'></div>");
       var rightDiv = $("<div class='right'></div>");
       
       $(tableToolbarDiv).append(leftDiv);
       $(tableToolbarDiv).append(centerDiv);
       $(tableToolbarDiv).append(rightDiv);
       $(th).append(tableToolbarDiv);
       $(TOOLBAR_THEAD).append(th);
       
       
       var buttons = _getCfgProp("toolbarButtons");
       $.each(buttons,function(k,v){           
           
           var btn = $("<input type='button'>");
           
           if(v.hasOwnProperty("title")) {
               $(btn).attr("value", v.title);
           }
           
           if(v.hasOwnProperty("cssClass")) {
               $(btn).attr("class", v.cssClass);
           }
           
           if(v.hasOwnProperty("action")) {               
               $(btn).click(function(){
                   v.action.call();
               });
           }
           
           
           var loc;
           if(v.hasOwnProperty("location") && v !== null) {
               loc =  v.location.toLowerCase();
           } else {
               loc = "left";
           }
                                     
            if(loc === "left") {
                $(leftDiv).append(btn);
            } else if(loc === "center") {
                $(centerDiv).append(btn);
            } else if(loc === "right") {
                $(rightDiv).append(btn);
            }
           
           
       });
                     
       $(TABLE).append(TOOLBAR_THEAD);              
   };
   
   
   /**
    * Shows the toolbar, if hidden
    * @returns {undefined}
    */
   /*public void*/this.showToolbar = function(){_showHideToolbar(true);};      
   
   /**
    * hides the toolbar, if shown
    * @returns {undefined}
    */
    /*public void*/this.hideToolbar = function(){_showHideToolbar(false);};
   
   
   /**
    * Shows/hides the toolbar
    * 
    * @param {Boolean} show - true shows toolbar, false hides it
    * @returns {undefined}
    */
    /*private void*/var _showHideToolbar = function(show){
       if(show){
           $(TOOLBAR_THEAD).show();
       } else {
           $(TOOLBAR_THEAD).hide();
       }
   };
   
   
   
   /**
    * 
    * _renderHeader - render the header for this table (contains navigation, etc.)
    * 
    * @returns {undefined}
    */
   /*private*/ var _renderHeader = function() {       
       
       var header = _getCfgProp("tableNavigation");
       
       var cols = CFG.data.headers.length;
       if(_getCfgProp("selectableRows")) {
           cols += 1;
       }
       
       if(typeof HEADER !== "undefined") {
           $(HEADER).remove();           
       }
       
       HEADER = $("<thead class='header'><tr></tr></thead>");
       var th = $("<th colspan='"+cols+"'></th>");
       
       var tableToolbarDiv = $("<div class='tableToolBar'></div>");
       var leftDiv = $("<div class='left'></div>");
       var centerDiv = $("<div class='center'></div>");
       var rightDiv = $("<div class='right'></div>");
       
       $(tableToolbarDiv).append(leftDiv);
       $(tableToolbarDiv).append(centerDiv);
       $(tableToolbarDiv).append(rightDiv);
       $(th).append(tableToolbarDiv);
       $(HEADER).append(th);

       // row text
       ROW_TEXT_SPAN = $("<span class='rowText'></span>");              
       if(header.hasOwnProperty("rowText")) {
            $(ROW_TEXT_SPAN).append(header.rowText);
            $(leftDiv).append(ROW_TEXT_SPAN);
       }
       
       
       // page text
       PAGE_TEXT_SPAN = $("<span class='pageText'></span>");       
       if(header.hasOwnProperty("pageText")) {
            $(leftDiv).append(" | ");
            $(PAGE_TEXT_SPAN).append(header.pageText);
            $(leftDiv).append(PAGE_TEXT_SPAN);
       }
       
       
       
        // ----PAGINATION----
       
        
        if(header.hasOwnProperty("pagination")) {
            
            // first
            var pageControlsSpan = $("<span class='pageControls'></span>");
            
            if(header.pagination.hasOwnProperty("first")) {
                 FIRST_BUTTON = $("<input type='button' title='Go to the first page' class='nav first'>");
                 if(header.pagination.first.hasOwnProperty("label")) {
                     $(FIRST_BUTTON).attr("value", header.pagination.first.label);
                 }
                 if(header.pagination.first.hasOwnProperty("action") && typeof header.pagination.first.action === "function") {
                     $(FIRST_BUTTON).click(header.pagination.first.action);
                 }
                 
                 $(pageControlsSpan).append(FIRST_BUTTON);                 
            }
            
            // prev
            if(header.pagination.hasOwnProperty("prev")) {
                 PREV_BUTTON = $("<input type='button' title='Go to the previous page' class='nav prev'>");           
                 if(header.pagination.prev.hasOwnProperty("label")) {
                     $(PREV_BUTTON).attr("value", header.pagination.prev.label);
                 }
                 if(header.pagination.prev.hasOwnProperty("action") && typeof header.pagination.prev.action === "function") {
                     $(PREV_BUTTON).click(header.pagination.prev.action);
                 }
                 $(pageControlsSpan).append(PREV_BUTTON);                 
            }
            
            // text input (jump to page)
            if(header.pagination.hasOwnProperty("jump")) {
                
                var jumpId = SELF.ID + "_jump";
                var jumpButtonId = SELF.ID + "_jumpButton";
                if(header.pagination.jump.hasOwnProperty("inputLabel")) {
                    var pageJumpLabel = $("<label for='"+jumpId+"'>"+header.pagination.jump.inputLabel+"</label>");
                    $(pageControlsSpan).append(pageJumpLabel);
                }
                
                PAGE_JUMP_INPUT = $("<input type='text' class='jump' id='"+jumpId+"'>");
                PAGE_JUMP_BUTTON = $("<input type='button' id='"+jumpButtonId+"'>");
                
                var pageJumpButtonLabel = "Go"; // default
                if(header.pagination.jump.hasOwnProperty("buttonLabel")) {
                    pageJumpButtonLabel = header.pagination.jump.buttonLabel;
                }
                
                if(header.pagination.jump.hasOwnProperty("action") && typeof header.pagination.jump.action === "function") {
                    $(PAGE_JUMP_BUTTON).click(header.pagination.jump.action);
                    $(PAGE_JUMP_INPUT).keydown(function(e){                        
                        var keyCode = (window.event) ? e.which : e.keyCode;                        
                        if(keyCode === 13) {
                            header.pagination.jump.action.call();
                        }
                    });
                } 
                
                $(PAGE_JUMP_BUTTON).attr("value", pageJumpButtonLabel);                
                $(pageControlsSpan).append(PAGE_JUMP_INPUT);
                $(pageControlsSpan).append(PAGE_JUMP_BUTTON);
            }
            
            
            // next
            if(header.pagination.hasOwnProperty("next")) {
                 NEXT_BUTTON = $("<input type='button' title='Go to the next page' class='nav next'>"); 
                 if(header.pagination.next.hasOwnProperty("label")) {
                     $(NEXT_BUTTON).attr("value", header.pagination.next.label);
                 }
                 if(header.pagination.next.hasOwnProperty("action") && typeof header.pagination.next.action === "function") {
                     $(NEXT_BUTTON).click(header.pagination.next.action);
                 }
                 $(pageControlsSpan).append(NEXT_BUTTON);                 
            }
            
            // last
            if(header.pagination.hasOwnProperty("last")) {
                 LAST_BUTTON = $("<input type='button' title='Go to the last page' class='nav last'>");  
                 if(header.pagination.last.hasOwnProperty("label")) {
                     $(LAST_BUTTON).attr("value", header.pagination.last.label);
                 }
                 if(header.pagination.last.hasOwnProperty("action") && typeof header.pagination.last.action === "function") {
                     $(LAST_BUTTON).click(header.pagination.last.action);
                 }
                 $(pageControlsSpan).append(LAST_BUTTON);                 
            }
            
                                    
            $(centerDiv).append(pageControlsSpan);            
        }
        
        
        // set up right-most DIVs
        var innerRight = $("<div class='innerRight'></div>");
        var innerRight_left = $("<div class='left'></div>");
        var innerRight_right = $("<div class='right'></div>");
        $(innerRight).append(innerRight_left);
        $(innerRight).append(innerRight_right);
        $(rightDiv).append(innerRight);
        
        // find input
        if(header.hasOwnProperty("find")) {                        
            var findInputlabelText = "Page";
            if(header.find.hasOwnProperty("inputLabel")) {                
                findInputlabelText = header.find.inputLabel;
            }
            
            
            var findId = SELF.ID + "_find";
            var findButtonId = SELF.ID + "_findButton";
            var findInputLabel = $("<label for='"+findId+"'>"+findInputlabelText+"</label>");
            $(innerRight_left).append(findInputLabel);
            
            PAGE_FIND_INPUT = $("<input type='text' class='find' id='"+findId+"'>");
            $(innerRight_left).append(PAGE_FIND_INPUT);
            
            PAGE_FIND_BUTTON = $("<input type='button' id='"+findButtonId+"'>");
            if(header.find.hasOwnProperty("action") && typeof header.find.action === "function") {
                $(PAGE_FIND_INPUT).keydown(function(e){                    
                    var keyCode = (window.event) ? e.which : e.keyCode;
                    if(keyCode === 13) {
                        header.find.action.call();
                    }
                });
                $(PAGE_FIND_BUTTON).click(header.find.action);                
            }                
            var findButtonLabelText = "Go";
            if(header.find.hasOwnProperty("buttonLabel")) {
                 findButtonLabelText = header.find.buttonLabel;
            }
            $(PAGE_FIND_BUTTON).attr("value", findButtonLabelText);
            $(innerRight_left).append(PAGE_FIND_BUTTON);
        }
        
        // rowsPerPage
        if(header.hasOwnProperty("rowsPerPage")) {
            ROWS_PER_PAGE = $("<select></select");
            if(header.rowsPerPage.hasOwnProperty("options")) {
                $.each(header.rowsPerPage.options, function(k,v) {
                    var opt = $("<option value='"+v+"'>"+v+" per page</option>");
                    if(header.rowsPerPage.hasOwnProperty("defaultValue")) {
                        if(header.rowsPerPage.defaultValue === v) {
                            $(opt).attr("selected", "selected");
                        }
                    }
                    $(ROWS_PER_PAGE).append(opt);
                });
            }
            
            if(header.rowsPerPage.hasOwnProperty("action") && typeof header.rowsPerPage.action === "function") {
                $(ROWS_PER_PAGE).change(function(){                    
                    header.rowsPerPage.action.call();                    
                });
            }
            
            $(innerRight_right).append(ROWS_PER_PAGE);            
        }
      
       
       $(TABLE).append(HEADER);
       
   };
   
   
   /**
    * sort
    * 
    * Sort table ascending or descending by criteria.
    * Example: .sort("make asec"), where "make" is the
    * sort column, and "asec" is the direction. Direction
    * can be "asec" or "desc", per TaffyDB syntax.
    * 
    * 
    * @param {String} byWhat - sort column
    * @param {String} dir - direction of sort: asec (ascending) or desc (descending)
    * @param {Object} dataType - the data type object from the header    
    */
   /*public*/this.sort = function(byWhat, dir, dataType) {  
       
        CURR_SORT_COL = byWhat;
        CURR_SORT_DIR = dir;
       
        SELF.empty();    
       
        // empty out array
        ROWS.length = 0;
       
       
        if(_getCfgProp("extSort") === false) {

            if(dataType !== null && dataType.hasOwnProperty("type")) {
                if(dataType.type === "date") {
                    if(dir === "ascending") {
                        dir = "asec";
                    } else if (dir === "descending") {
                        dir = "desc";
                    }
                }        
            }
       
       
            if(dir === "ascending") {dir = "";}
            if(dir === "descending") {dir = "logicaldesc";}

            var orderClause = "__sortField__" + byWhat +  " " + dir;

            DB().order(orderClause).each(function(r){
                ROWS.push(r);
            });
            
       } else {
           DB().each(function(r){
                ROWS.push(r);
            });
       }
       
       _renderTbody(); 
       
       
       if(_getCfgProp("scrollable")) {
           SELF.resetScrollable();
           SELF.makeScrollable();           
       }
       
        _onSort();
       
   };
   

   
   /**
    * makeScrollable - make table scrollable (adds scrollbars)
    *     
    */
   /*public*/this.makeScrollable = function() {
        
        if(IS_SCROLLABLE) { return; }
        
        var height = _getCfgProp("scrollHeight") || "100px";        
        var tWidth = $(TABLE).innerWidth();

        $(TARGET).css("height", height);
        $(TARGET).css("overflow-y", "auto");
        $(TARGET).css("width", tWidth+"px");

        if(typeof $(TABLE).floatThead === "function") {            
            $(TABLE).floatThead({
                scrollContainer: function(TABLE){
                    return TABLE.closest(TARGET);
                }
            });            
        } else {
            throw "Griddy requires the \"floatThead\" lQuery plugin (jquery.floatThead.min.js) for scrollable tables with fixed headers.";
        }
        
        IS_SCROLLABLE = true;
   };
   
   /**
    * resetScrollable - reset scrolling of the table (do not make 
    * scrollable).
    * 
    */
   /*public*/this.resetScrollable = function() {       
       
        if(! IS_SCROLLABLE) { return; }
       
        if(typeof $(TABLE).floatThead === "function") {      
            $(TABLE).floatThead("destroy");
        }
        $(TARGET).css("height", "auto");
        $(TARGET).css("overflow-y", "visible");
        $(TARGET).css("width", "auto");
        
        IS_SCROLLABLE = false;
   };
   
   
   /**
    * selectAllRows - selects all the rows in the table
    *    
    */
   /*public*/this.selectAllRows = function() {              
       $.each(ROW_CBOXES, function(k,v){                        
            $(v).prop("checked", $(SELECT_ALL_CBOX).is(":checked"));                        
        });
        // mark each row in the data
        $.each(ROWS, function(k,v){
            v.___selected = $(SELECT_ALL_CBOX).is(":checked");
        });
   };
   
   /*
    * deleteRows - remove rows from table 
    *
    * This method takes variable arguments. The first arg can be
    * a boolean or array, the second, optional argument can be
    * a boolean. The array should be a list of row numbers to 
    * delete, the boolean should be the flag to indicate that
    * the record shoul be removed from the data.
    * 
    * If the boolean is false, the row is hidden, but the record
    * will remain intact in the data and the __deleted flag set to true.
    * 
    * If the boolean is true, the row is hidden, and record will be
    * removed from the data.
    * 
    * Format:
    * deleteRows([boolean|array][,boolean]);
    * 
    * The following calls are all valid: 
    * 
    * deleteRows(); // delete selected rows, only mark as deleted
    * deleteRows(true); // delete selected rows, remove records from data
    * deleteRows([1,4,7]); // delete specific row numbers, only mark as deleted
    * deleteRows([1,4,7], true); // delete specific row numbers, remove records from data
    * 
    * @param See method comments - this take variable arguments
    * @returns {undefined}
    */
   /*public*/this.deleteRows = function() {
       
       var rowNumsToDel = null;
       var deleteRecord = false;
       var toDelete = [];
       
       if(arguments.length === 1) {
           if(typeof arguments[0] === "boolean") {
               deleteRecord = arguments[0];
           } else if(typeof arguments[0] === "object") {
               rowNumsToDel = arguments[0];
           }
       } else if(arguments.length === 2) {
           if(typeof arguments[0] === "object" && typeof arguments[1] === "boolean") {
               rowNumsToDel = arguments[0];
               deleteRecord = arguments[1];
           }
       }
       
              
       $(TABLE).find("tbody").find("tr").each(function(k,v){           
           if(rowNumsToDel === null) {                 
                if(ROWS[k] && ROWS[k].___selected) {
                    $(v).hide();               
                    if(deleteRecord) {                  
                        toDelete.push(k);
                    } else {
                        // only mark as deleted
                        if(ROWS[k]) {
                            ROWS[k].___deleted = true;
                        }
                    }
                }                      
         } else {         
             $.each(rowNumsToDel, function(k2,v2){                 
                 if(k === v2-1) {
                    $(v).hide();               
                    if(deleteRecord) {                  
                        toDelete.push(k);
                    } else {
                        // only mark as deleted
                        if(ROWS[k]) {
                            ROWS[k].___deleted = true;
                        }
                    }
                 }
             });
             
         }
       });
       
       if(deleteRecord) {
            for (var i = toDelete.length -1; i >= 0; i--) {
                ROWS.splice(toDelete[i],1);
            }
       }                    
   };
   
   
   /**
    * empty - removes all rows
    * 
    * @returns {undefined}
    */
   /*public*/this.empty = function() {
       $(TBODY).empty();
   };
   
   
   /*public*/this.renderRows = function() {
       $(TBODY).empty();
       _prepareData();
       _renderTbody();
   };
   
   
   /**
    * reset - resets table to original condition (removes 
    * all sorts and/or filters) and renders table again.
    * 
    */
   /*public*/this.reset = function() {
       SELF.empty();
       _prepareData();
       _renderTbody();
   };
   
   /**
    * getData - get data from the table.
    * 
    * @returns {undefined}
    */
   /*public*/this.getData = function() {       
       
       // If this is an empty grid, there are no internal identifiers or 
       // or other junk, but there may be a selected property.
        if(_getCfgProp("emptyGrid")) {
            $.each(ROWS, function(k,v){
                if(v.hasOwnProperty("___selected")) {  
                    delete v.___selected;
                }                
            });
            return ROWS;
            
        // If this is an editable grid, strip out the interal "junk" 
        // used for sorting, etc.
        } else if(_getCfgProp("editable")) {            
            var rows_copy = $.extend(true, {}, ROWS);            
            $.each(rows_copy, function(k,v){
                $.each(v, function(k2,v2){
                    if(k2.match(/^__/)) {
                        delete v[k2];
                    }
                    
                    // Also convert fields with objects as values to plain string values
                    if(typeof v2 === "object" && v2 !== null) {                        
                        if(v2.hasOwnProperty("value")) {
                            v[k2] = String(v2.value);                            
                        }                        
                    }
                });                                
            });
            
            var rows_copy_array = [];
            $.each(rows_copy, function(k,v){rows_copy_array.push(v);});
            return rows_copy_array;            
            
        // If it's a read-only grid, reutn the data that it was originally passed
        } else {
            return ORIGINAL_DATA;
        }
        
   };
   
   
   /**
    * setData - set new data for the table
    * 
    * @param {type} data
    */
   /*public*/this.setData = function(data) {       
      CFG.data.rows = data;      
   };
   
   
   
   
   /**
    * edit - Convert table values to textboxes 
    * to enable editing of cells.
    * 
    * @returns {undefined}
    */
   /*public*/this.edit = function() {
       
       if(EDIT_MODE === true) {
           CFG.editable = false;
           EDIT_MODE = false;
           this.reset();
       } else {
           CFG.editable = true;
           EDIT_MODE = true;
           this.reset();
       }
       
        _hideAllSortButtons();                     
   };
   
   
   
   /*public*/this.getRowsPerPage = function() {
       return $(ROWS_PER_PAGE).val();
   };
   
   /*public*/this.setRowsPerPage = function(val) {
       return $(ROWS_PER_PAGE).val(val);
   };
   
   
   /*public*/this.getFindValue = function() {
       return $(FIND).val();
   };
   
   /*public*/this.setFindValue = function(val) {
       return $(FIND).val(val);
   };
   
   
   /*public*/this.getJumpValue = function() {
       return $(JUMP).val();
   };
   
   /*public*/this.setJumpValue = function(val) {
       return $(JUMP).val(val);
   };
   
   
   /*public*/this.getSortCol = function() {
       return {sortId:CURR_SORT_COL, dir: CURR_SORT_DIR};       
   };
   
   
   /**
    * highlightRows - specify row(s) to be highlighted (primvate implementation)
    * 
    * Usage: 
    * _highlightRows(true, [5,6]); // highlight rows 5 and 6
    * _highlightRows(true, [3]); // highlight row 3
    * _highlightRows(false, [3]); // remove highlight from row 3
    * _highlightRows(false); // remove highlight from ALL rows
    *     
    * @param {Boolean} highlightFlag - true: turn on, false: turn off
    * @param {Array} rowNums - List of row numbers to highlight
    */
   /*private*/var _highlightRows = function(highlightFlag,rowNums) {
       
       // if no rows are passed in, get all of them
       if(typeof rowNums === "undefined") {
           rowNums = [];
           $(TBODY).find("tr").each(function(k,v){
               rowNums.push(k+1);
           });
       }
       
       $(TBODY).find("tr").each(function(k,v) {           
           $.each(rowNums, function(k2,v2) {
               if(k+1 === rowNums[k2]) {     
                if(highlightFlag) {
                    $(v).addClass("highlightedRow");
                } else {
                    $(v).removeClass("highlightedRow");
                }
              }
           });
                      
       });
   };
   
   /**
    * highlightRows - specify row(s) to be highlighted
    * 
    * Usage: 
    * myGriddy.highlightRows([5,6]); // highlight rows 5 and 6
    * myGriddy.highlightRows([3]); // highlight row 3
    * myGriddy.highlightRows(); // highlight ALL rows
    * 
    * @param {Array} rowNums - List of row numbers to highlight    
    */
   /*public*/this.highlightRows = function(rowNums) {
        _highlightRows(true, rowNums);
   };
   
   
   
   /**
    * unhighlightRows - remove highlight from rows (if previously added)
    * 
    * Usage: 
    * myGriddy.unhighlightRows([5,6]); // un-highlight rows 5 and 6
    * myGriddy.unhighlightRows([3]); // un-highlight row 3
    * myGriddy.unhighlightRows(); // un-highlight ALL rows
    * 
    * @param {Array} rowNums - List of row numbers to highlight    
    */
   /*public*/this.unhighlightRows = function(rowNums) {
        _highlightRows(false, rowNums);
   };
   
   
   // dataTable.disableNavElements(["first","prev", "next","last", "jumpButton", "findButton"]);
   /*private*/var _disableNavElements = function(disableFlag, items) {
       
       var allNavElems = [FIRST_BUTTON,PREV_BUTTON,NEXT_BUTTON,LAST_BUTTON,
                         PAGE_JUMP_BUTTON,PAGE_JUMP_INPUT,PAGE_FIND_BUTTON,
                         PAGE_FIND_INPUT, ROWS_PER_PAGE];
       
       var itemToDisable;
       
       if(typeof items === "undefined") { items = []; }
       
       $.each(items, function(k,v){
           switch(v) {
                case "first":
                    itemToDisable = FIRST_BUTTON;                   
                    break;
                case "prev": 
                   itemToDisable = PREV_BUTTON;                   
                   break;
                   
                case "next": 
                   itemToDisable = NEXT_BUTTON;                   
                   break;
                
                case "last": 
                   itemToDisable = LAST_BUTTON;                   
                   break;
                   
                case "jumpInput": 
                   itemToDisable = PAGE_JUMP_INPUT;                   
                   break;
                   
                case "jumpButton": 
                   itemToDisable = PAGE_JUMP_BUTTON;                   
                   break;
                   
                case "findButton": 
                   itemToDisable = PAGE_FIND_BUTTON;                   
                   break;
                   
                case "findInput": 
                   itemToDisable = PAGE_FIND_INPUT;                   
                   break;
                   
                case "rowsPerPage": 
                   itemToDisable = ROWS_PER_PAGE;                   
                   break;
                   
               default:
                   // nada...
                   break;
                
                   
           }
           
            if(disableFlag === true) {
                $(itemToDisable).attr("disabled", "disabled");
                $(itemToDisable).addClass("disabled");
                
            }  else {
                $(itemToDisable).removeAttr("disabled");
                $(itemToDisable).removeClass("disabled");
            }
               
       });
       
       
       if(items.length === 0) {
           $.each(allNavElems, function(k,v){
                if(disableFlag === true) {
                    $(v).attr("disabled", "disabled");
                    $(v).addClass("disabled");
                } else {
                    $(v).removeAttr("disabled");
                    $(v).removeClass("disabled");
                }
           });
       }
       
   };
   
   
   
   
   /*public*/this.disableNavElements = function(items) {                
        _disableNavElements(true,items);       
   };
   
   
   /*public*/this.enableNavElements = function(items) {                
        _disableNavElements(false,items);       
   };
   
   
   /**
    * setTableNavigation - Set the JSON for the table navigation toolbar
    * and re-render.
    * 
    * @param {type} navItems    
    */
   /*public*/this.setTableNavigation = function(navItems) {                
       CFG.tableNavigation = navItems;
        _renderHeader();
   };
   
   
   
   /*public*/this.setPageText = function(txt) {
       $(PAGE_TEXT_SPAN).text(txt);
   };
   
   
   /*public*/this.setRowText = function(txt) {
       $(ROW_TEXT_SPAN).text(txt);
   };
   
   
   
   /**
    * setSortedCol - manually set the currently sorted column
    * 
    * Usage: 
    * 
    * // set the column using "first" as sort ID as being sorted ascending
    * dataTable.setSortedCol("first", "ascending");
    * // set the column using "last" as sort ID as being sorted descending
    * dataTable.setSortedCol("last", "descending"); 
    * // set the column using "last" as sort ID as not being sorted ("both")
    * dataTable.setSortedCol("last", "both"); 
    * 
    * @param {type} sortId - the sortId used in the header data for that column
    * @param {type} dir - the direction of sort; "ascending", "descending", or "both" (to reset)
    */
   /*public*/this.setSortedCol = function(sortId, dir) {
       
       if(typeof dir !== "undefined" && typeof sortId !== "undefined") {
           
           // check for valid sortId
           var validIDs = [];
           $.each(CFG.data.headers, function(k,v){
               validIDs.push(v.sortId);
           });
           

           if($.inArray(sortId, validIDs) === -1) {
               throw "Invalid sortId. Check your header data for valid IDs.";
           }
           
            if(dir === "ascending" || dir === "descending" || dir === "both") {
                
                _resetSortIndicators();
                
                if(dir === "both") { return; }
                                    
                var baseId = SELF.ID + "_sortButton_" + sortId;
                                                
                $("#"+baseId + "_" + dir).hide();
                var tmpId = dir.charAt(0).toUpperCase() + dir.slice(1);
                $("#"+baseId + "_active" +tmpId).show();
                                                
            } else {
                throw "Invalid sort direction. Valid directions are 'ascending' or 'descending', or 'both' (to reset).";
            }
       } 
   };
   
   /**
    * Hide columns by sortId. A single sortId or list of sortIds
    * can be passed.
    * 
    * @param {Array or String} sortIds
    * @returns {undefined}
    */
   /*public*/this.hideCols = function(sortIds) {       
       _showCols(_extractArray(sortIds), true);
   };
   
   
   /**
    * Shows columns by sortId. A single sortId or list of sortIds
    * can be passed.
    * 
    * @param {Array or String} sortIds
    * @returns {undefined}
    */
   /*public*/this.showCols = function(sortIds) {
       _showCols(_extractArray(sortIds), false);
   };
   
   
   /**
    * Hides/shows a list of columns by sortId.
    * 
    * @param {type} sortIds - list of sortIds to process
    * @param {type} hide - hide the colmns instead of showing
    * @returns {undefined}
    */
   /*private*/var _showCols = function(sortIds, hide) {
       $.each(sortIds, function(k,v){          
           $(TABLE).find('*[data-row-name="'+v+'"]').each(function(k2,v2){
            if(hide === true) {
                $(v2).hide();
            } else {
                $(v2).show();
            }                           
        });                      
       });             
   };
   
   
   
   /**
    * on -  Register events with callback functions. For a given, supported
    *       event, a function refereence can be passed in to be
    *       called when that event fires.
    * 
    *       Example: myTable.on("change", function() {alert("You changed me!")});
    *       
    *       Supported events:
    *           change          In edit moode, any of the values are changed
    *           sort            A column is sorted in any direction
    *           click           Any area of the table is clicked
    *           hover           Any area of the table is hovered with the mouse
    *           ready           The table is done rendering and ready
    *           select          Any or all of the rows are selected (if selectableRows is true)
    * 
    * @param {String} event
    * @param {function} callback
    */
   /*public void*/this.on = function(event, callback) {
       switch(event) {
           case "change":
               ON_CHANGE_CALLBACK = callback;
               _onChange(callback);
               break;
               
            case "sort":
                ON_SORT_CALLBACK = callback;
                break;
                
            case "click":
                _onClick(callback);
                break;
                
            case "ready":
                ON_READY_CALLBACK = callback;
                _onReady();
                break;
                
            case "hover":
                _onHover(callback);
                break;
                
            case "select":
                _onSelect(callback);
                break;
                
           case "add":
                ON_ADD_ROW_CALLBACK = callback;                
                break;
                
           default:
               // do nothing;
       }
   };
   
   
   /**
    * Sets up callbacck for "change" event.
    * 
    * @param {type} callback
    * @returns {undefined}
    */
   /*private*/var _onChange = function(callback) {       
        $(TABLE).find("input").change(function() {
            callback.call();
        });
   };
   
   /**
    * Sets up callbacck for "sort" event.
    * @returns {undefined}
    */
   /*private*/var _onSort = function() {
       if(typeof ON_SORT_CALLBACK === "function") {
           ON_SORT_CALLBACK.call();
       }
   };
   
   /**
    * Sets up callbacck for "click" event.
    * 
    * @param {type} callback
    * @returns {undefined}
    */
   /*private*/var _onClick = function(callback) {
       $(TABLE).click(function(){
           callback.call();
       });
   };
   
   
   /**
    * Sets up callbacck for "ready" event.
    * 
    * @returns {undefined}
    */
   /*private*/ var _onReady = function() {
       if(typeof ON_READY_CALLBACK === "function") {
           ON_READY_CALLBACK_CALLED = true;
           ON_READY_CALLBACK.call();                                                      
       }              
   };
   
   /**
    * Sets up callbacck for "hover" event.
    * 
    * @param {type} callback
    * @returns {undefined}
    */
   /*private*/ var _onHover = function(callback) {
       $(TABLE).hover(function(){
           callback.call();
       });
   };
   
   /**
    * Sets up callbacck for "select" event.
    * 
    * @param {type} callback
    * @returns {undefined}
    */
   /*private*/ var _onSelect = function(callback) {
       $(TABLE).find("input[type=checkbox]").click(function(){
           callback.call();
       });
   };
      
   
   
   
   /**
    * _gracefulNull - Gracefully handle null values by displaying them as
    * an empty string.
    * 
    * @param {type} val
    * @returns {String}
    */
   /*private*/ var _gracefulNull = function(val) {
       if(_getCfgProp("gracefulNull")) {
           return _nullAsString(val);
       }
       return val;
   };
   
   

    /**
     * Returns null value as an empty string.
     * 
     * @param {type} val
     * @returns {String}
     */
    /*private*/ var _nullAsString = function(val) {       
       return val === null ? "" : val;       
   };
   
   
   /**
    * Creates a value suitable for sorting, stripped of all 
    * spaces and all lowercase, and of course stringfied.
    * 
    * @param {String} val - the input strng or number
    * @return {String} the modified value
    */
   /*private*/ var _getSortValue = function(val) {
       
       val = String(_nullAsString(val));
       val = val.replace(/\s+/g,"");
       val = val.replace(/[^a-zA-Z\d\s:]/g,"");
       
       if(val.match(/^\d+$/)) {                      
           return parseInt(val);        
       }             
       
       return val;
   };
   
   
   /**
    * Returns a random ID
    * 
    * @returns {String}
    */
    /*private*/ var _getRandomId = function() {       
       return Math.random().toString(36).substring(7);
   };
            
   
   /*private*/ var _getCfgProp = function(propName) {       
       if(CFG.hasOwnProperty(propName)) {
           return CFG[propName];
       } else {
           return false;
       }
   };   
   
   
   /*private*/ var _getDataType = function(header) {
       
       var dataType = null;
       
       if(header.hasOwnProperty("dataType")) {           
           dataType = {};            
            if(header.dataType.hasOwnProperty("type")) {
                if(header.dataType.type === "date") {
                    dataType.type = header.dataType.type;
                }
                if(header.dataType.hasOwnProperty("format")) {
                    dataType.format = header.dataType.format;
                }
            }
            
            if(header.dataType.hasOwnProperty("mask")) {
                dataType.mask = header.dataType.mask;
            }
        }
        
        return dataType;
   };
   
   /**
    * Get the field type for a given header. Valid types would
    * be textbox, checkbox, radio, and select
    * 
    * @param {type} header
    * @returns {Griddy._getFieldType.fieldType}
    */
   /*private*/ var _getFieldType = function(header) {
       
       var fieldType = {};       
       
       if(typeof header !== "undefined" && header.hasOwnProperty("fieldType")) {                      
            if(header.fieldType.hasOwnProperty("type")) {
                if(header.fieldType.type.match(/checkbox|textbox|radio|select/i)) {
                    fieldType.type =  header.fieldType.type;
                }
                if(header.fieldType.hasOwnProperty("cssClass")) {
                    fieldType.cssClass = header.fieldType.cssClass;
                }
                if(header.fieldType.hasOwnProperty("cssStyle")) {
                    fieldType.cssStyle = header.fieldType.cssStyle;
                }
            }
        } else {
            fieldType.type = "textbox";
        }
        
        return fieldType;
   };
   
   
   
   /**
    * Logs messages to the console if the browser supports it. Messages
    * are also added ot the public array ERROR_LOG.
    * 
    * @param {String} msg - the message to report
    */
   /*private void*/ var _log = function(msg) {       
       if(typeof console !== "undefined" && typeof console.error !== "undefined") {
           console.error(msg);
           SELF.ERROR_LOG.push(msg);
       }
   };
   
   
   
   /**
    * Returns a value based on its data type.
    * Supported data types are:
    * 
    * date, int, and float
    * 
    * The date type can support nearly any kind of date format.
    * 
    * @param {Object} value - the input value
    * @param {String} dataType - one of the supported data types. If none is provided, original value is retuened.
    *                               
    */
   /*private*/ var _getDtValue = function(value, dataType) {
       
       if(typeof dataType !== "undefined" && dataType !== null && dataType.hasOwnProperty("type")) {

            // Date ---------------------------
            if(dataType.type === "date") {
                var mask;
                if(dataType.hasOwnProperty("format")) {
                    mask = dataType.format;
                } else {
                    mask = "MM/DD/YYYY";
                }      


                if(value === "null" || value === null) {value = "";}

                var tmpDate = new Date(value);                   

                if(typeof moment === "undefined") {
                    var errMsg = "ERROR: The Griddy widget requires moment for date formatting (moment.js). \n" + 
                     "Please include this as a resource in your application.";
                    _log(errMsg);
                    if(! tmpDate.toString().match(/Invalid Date|NaN/i)) {
                        return tmpDate.toString();                           
                    } else {                           
                        return value;
                    }

                } else {                       
                    if(! tmpDate.toString().match(/Invalid Date|NaN/i)) {
                        return moment(tmpDate).format(mask);
                    } else {                           
                        return value;
                    }   

                }

            }


            // Integer ---------------------------
            if(dataType.type === "int") {
                return parseInt(value);
            }


            // float ---------------------------
            if(dataType.type === "float") {
                return parseFloat(value);
            }
       } else {
           return value;
       }
   };
   
   
   /*private*/var _resetSortIndicators = function() {
       $.each(DESC_ACTIVE_SORT_BUTTONS, function(k2,v2){
            $(v2).hide();
        }); 

        $.each(ASC_ACTIVE_SORT_BUTTONS, function(k2,v2){
            $(v2).hide();
        }); 

        $.each(DESC_SORT_BUTTONS, function(k2,v2){
            $(v2).show();
        }); 

        $.each(ASC_SORT_BUTTONS, function(k2,v2){
            $(v2).show();
        }); 
   };
   
   
   /*private*/var _isEmptyString = function(str) {
       if(typeof str === "string") {
           if(str !== null) {
               if(str !== "") {
                   return false;
               }
           }
       }              
       return true;
   };
   
   
   /**
    * Determine if as cell is editable. If the "editable" property
    * does not exist, assume the cell is editable (if the table is editable).
    * In other words, the "editable" property must exist and explicitly be set
    * to false for the cell NOT to be editable.
    * 
    * @param {type} header
    * @returns {Boolean}
    */
   /*private*/ var _isEditableCell = function(header) {
       if(header.hasOwnProperty("editable")) {
           return Boolean(header.editable);           
       } else {              
           return true;
       }       
   };
   
   
   /**
    * Extract an array from a string. If the arg is already
    * an object or array, return it, if it's a string, return
    * a single-element array with that string.
    * 
    * @param {type} obj
    * @returns {Array}
    */
   /*private*/ var _extractArray = function(obj) {
       var t = typeof obj;
       if(t === "object" || t === "array") {
           return obj;
       } else if(t === "string") {
           return [obj];
       }
   };
   
   /**
    * Gets a boolean value from a string, boolean, or number.
    * 
    * All these values result in true:
    * true, "t", "T", "true", "TRUE", "trUE",
    * "y", "Y", "YES", "yes", "yEs", 1, 2, 69     
    * 
    * All other cases result in false, including, but not limited to:
    * false, "F", "f", "false", "FALse",
    * "n", "N", "NO", "no", "No", 0, -2, -69,
    * "some string blah balh", or any object or type that is not a string, boolean, or number
    * 
    * @param {type} val
    * @returns {Boolean|Griddy._getBoolean.boolVal}
    */
   /*private*/ var  _getBoolean = function(val) {
       var boolVal = false;              
              
       if(val !== null && typeof val === "string" && val.match(/y|yes|t|true|1|checked/i)) {
           boolVal = true;
       } else if(typeof val === "boolean") {
           boolVal = val;
       } else if(typeof val === "number") {
           if(val > 0) {
               boolVal = true;
           }
       }
       
       return boolVal;
   };
   
   
   /**
    * Hides all sort buttons, effectively preveting sorting
    * 
    * @returns {undefined}
    */
   var _hideAllSortButtons = function() {
       
    $.each(ASC_ACTIVE_SORT_BUTTONS, function(k,v) { $(v).hide(); });
    $.each(ASC_SORT_BUTTONS, function(k,v) { $(v).hide(); });
    $.each(DESC_ACTIVE_SORT_BUTTONS, function(k,v) { $(v).hide(); });
    $.each(DESC_SORT_BUTTONS, function(k,v) { $(v).hide(); });       
    
   };
   
   /**
    * Adds a row to the table
    * 
    * @returns {Object} newTr - new TR (row) added to the table
   */
   /*public void*/this.addRow = function() {      
       
       var partialEditMode = false;
       
       // Force the table into edit mode if add is called - only new
       // rows can be added and edited. Existing rows must stay un-editable.
       // See very bottom of this method, where all rows are disabled except new ones
       if(_getCfgProp("editable") === false) {            
           if(! EDIT_MODE) { 
               this.edit(); 
               partialEditMode = true;
           }
       }
       
       // Get and clone the last row of data              
       $.extend({}, this.getData() );
       var newDataRow = $.extend({}, this.getData()[0] );
       // empty out any existing values
       $.each(newDataRow, function(k,v){           
           newDataRow[k] = "";
       });
       
       // add the last row of data to the begining of the master data array        
       ROWS.unshift(newDataRow);
       
       // clone the last row of the table and set the odd/even class       
       var newTr = $(TBODY).find("tr").first().clone();
       var currClass = $(newTr).attr("class");       
       currClass = currClass === "even" ? "odd" : "even";
       $(newTr).attr("class", currClass);
       
       
       // properly increment row numbers, if they exist
       if(_getCfgProp("showRowNums")) {
            $(newTr).find("td").each(function(k,v){           
                var rowNum = $(v).attr("data-row-num");           
                if (typeof rowNum !== typeof undefined && rowNum !== false) {          
                    $(v).attr("data-row-num", "");
                    $(v).text("");                    
                }
            });
        }
       
       
       // empty out existing values from inputs/controls and change
       // listeners to update the output data
       $(newTr).find("input,select").each(function(k,v){
           if($(v).prop("type") === "text") {
               
               $(v).val("");
               
               // search in the header for the corresponding sortId
               // and add a mask, if applicable
               $.each(CFG.data.headers, function(k2,v2){
                   if(v2.sortId === $(v).attr("data-column-ref-id")) {                       
                       if(v2.hasOwnProperty("dataType")) {
                           if(v2.dataType.hasOwnProperty("mask")) {                              
                                if($.fn.mask !== "undefined") {                                                                                   
                                    if(! _isEmptyString(v2.dataType.mask)) {
                                        $(v).mask(v2.dataType.mask);
                                    }
                                }                               
                           }
                       }
                   }
               });
               
               $(v).change(function(){                    
                    newDataRow[$(v).attr("data-column-ref-id")] = $(v).val();
                });
           }
           
           if($(v).prop("type") === "checkbox") {
               if($(v).is(":checked")) {
                   $(v).prop("checked", false);
               } 
               $(v).change(function(){
                    newDataRow[$(v).attr("data-column-ref-id")] = $(v).is(":checked").toString();
                });
           }
           
           // remove error class that may have been added
           $(v).removeClass("editableValueError");
           $(v).removeClass("modified");
           
           // remove any cloned ID - this will not be useful when adding rows
           $(v).removeAttr("id");
           
       });
              
      
       
       
       // add the cloned and modified row to the table
       $(TBODY).prepend(newTr);
       //$(TBODY).append(newTr);     
       
       // register the onchange events again        
       $(newTr).find("input").change(ON_CHANGE_CALLBACK);
        
       
       // Execute the callback if it's defined.
       if(ON_ADD_ROW_CALLBACK !== null && typeof ON_ADD_ROW_CALLBACK === "function") {
           ON_ADD_ROW_CALLBACK.call();
       }
       
       ADDED_ROWS.push(newTr);
       
       
       // if the tabloe is NOT editable but the user added rows, disable previous
       // rows so they can't be changed and only the newly added rows can be edited
       if(partialEditMode === true) {
            // first disable everything
            $(TABLE).find("tbody").find("td").find("input,select").prop("disabled",true);           
            // re-enable the newly added rows
            $.each(ADDED_ROWS,function(k,v){ $(v).find("input,select").prop("disabled",false); });                     
       }
              
       return newTr;       
   };
   
   /**
    * addRows - add multiple rows
    * 
    * This just calls addRow the specified number of times and returns
    * the list of rows added.
    * 
    * @param {type} num - the number of rows to add
    * @returns {Array} - the array of added rows
    */
   /*public*/ this.addRows = function(/*number*/num) {       
       
       var addedRows = [];
       
       while(num--) {
           var r = this.addRow();
           addedRows.push(r);
       }
       
       return addedRows;
   };
   
   /**
    * 
    * @param {type} rowNums
    * @param {type} disable
    * @returns {Array|Griddy._disOrEnableRows.affectedRows}
    */
   var _disOrEnableRows = function(rowNums, disable) {       
       
       var affectedRows = [];
       
       
       $(TBODY).find("tr").each(function(k,v){
           if(rowNums) {
                if($.inArray(k+1, rowNums) > -1) {
                    $(v).find("input,select").prop("disabled", disable);
                    
                }
           } else {
               $(v).find("input,select").prop("disabled", disable);                
           }
           
           affectedRows.push(v);
       });       
       
       return affectedRows;
   };
   
   /**
    * enableRows - enable rows in the table for editing (if in edit mode).
    * 
    * Note: The effect of this call is additive - meaning that any rows already enabled
    * will remain enabled. The specified list does not represent an absolute set. For example,
    * caling enableRows([1,2]) will enables rows 1 and 2. Calling enableRows([7,9]) will enable
    * rows 7 and 9, but will not disable rows 1 and 2.
    * 
    * 
    * enableRows(); // enables all rows
    * enableRows([1,4,7]); // enables rows 1,4,7
    * 
    * @param {type} rowNums - list of row nums to enable (empty enables all rows)
    * @returns {Array|Griddy._disOrEnableRows.affectedRows}
    */
   this.enableRows = function(rowNums) {
       return _disOrEnableRows(rowNums, false);
   };
   
   /**
    * enableRows - disable rows in the table for editing (if in edit mode)
    * 
    * Note: The effect of this call is additive - meaning that any rows already disabled
    * will remain disabled. The specified list does not represent an absolute set. For example,
    * caling disableRows([1,2]) will disable rows 1 and 2. Calling disableRows([7,9]) will disable
    * rows 7 and 9, but will not enable rows 1 and 2.
    * 
    * disableRows(); // disables all rows
    * disableRows([1,4,7]); // disables rows 1,4,7
    * 
    * @param {type} rowNums
    * @returns {Array|Griddy._disOrEnableRows.affectedRows}
    */
   this.disableRows = function(rowNums) {
       return _disOrEnableRows(rowNums, true);
   };
   
   /**
    * Gets the table HTML element so it can be manipulated as you see fit.
    * @returns {undefined}
    */
   this.getTable = function(){
       return $(TABLE);
   };
   
       
    
}; 
