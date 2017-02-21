// Core
import {
    AfterViewInit,
    Component,
    ElementRef,
    ViewChild
} from '@angular/core';

// Third party
import { NotificationsService } from 'angular2-notifications';

// Own
import { EditorTab, OPERATION_STATUS, EDITOR_STATUS } from './editor.tab';
import { GitHubService } from './components/github/github.service';
import { BoardExplorerComponent }
    from './components/board-explorer/board-explorer.component';
import { WebUsbService } from '../../shared/webusb/webusb.service';


declare var $: any;

@Component({
  moduleId: module.id,
  selector: 'sd-editor',
  templateUrl: 'editor.component.html',
  styleUrls: ['editor.component.css'],
  providers: [GitHubService]
})
export class EditorComponent implements AfterViewInit {
    public notificationOptions = {
        timeOut: 5000
    };

    private readonly MAX_TABS: number = 10;

    // Childen

    @ViewChild('tabMenu')
    private tabMenu: ElementRef;

    @ViewChild('boardExplorer')
    private boardExplorer: BoardExplorerComponent;

    // Variables

    private tabs: Array<EditorTab> = [{
        id: 1,
        active: true,
        title: 'Tab # 1',
        editor: null,
        port: null,
        term: null
    }];

    // Methods

    constructor(
        private notificationsService: NotificationsService,
        private webusbService: WebUsbService) {
    }

    public ngAfterViewInit() {
        this.setDefaultTabStatuses(1);
    }

    private getTabById(id: number): EditorTab {
        for (let tab of this.tabs) {
            if (tab.id === id) {
                return tab;
            }
        }
        return null;
    }

    private getFirstAvailableTabId(): number {
        let max = 0;
        for (let tab of this.tabs) {
            if (tab.id > max) {
                max = tab.id;
            }
        }
        return max + 1;
    }

    // tslint:disable-next-line:no-unused-variable
    private onCloseTab(id: number) {
        let tab = this.getTabById(id);
        let index = this.tabs.indexOf(tab);
        this.tabs.splice(index, 1);

        if (this.tabs.length > 0) {
            this.tabs[this.tabs.length - 1].active = true;
        } else {
            this.newTab();
        }
    }

    // tslint:disable-next-line:no-unused-variable
    private onActivateTab(tab: EditorTab) {
        for (let t of this.tabs) {
            t.active = false;
        }
        tab.active = true;
    }

    private setDefaultTabStatuses(id: number) {
        let tab = this.getTabById(id);

        tab.connectionStatus = OPERATION_STATUS.NOT_STARTED;
        tab.uploadStatus = OPERATION_STATUS.NOT_STARTED;
        if (this.webusbService.usb !== undefined) {
            tab.editorStatus = EDITOR_STATUS.READY;
        } else {
            tab.editorStatus = EDITOR_STATUS.WEBUSB_UNAVAILABLE;
        }
    }

    // tslint:disable-next-line:no-unused-variable
    private mayAddTab(): boolean {
        return this.tabs.length < this.MAX_TABS;
    }

    // tslint:disable-next-line:no-unused-variable
    private newTab(): EditorTab {
        let id = this.getFirstAvailableTabId();
        let tab: EditorTab = {
            id: id,
            active: true,
            title: 'Tab # ' + id,
            editor: null,
            port: null,
            term: null
        };

        for (let other of this.tabs) {
            other.active = false;
        }

        // Before creating the new tab (i.e. adding it to `this.tabs`, make
        // the previously last tab active, to workaround bugs in Bootstrap:
        // https://github.com/twbs/bootstrap/issues/21223
        $(this.tabMenu.nativeElement).find('a:last').tab('show');

        this.tabs.push(tab);
        this.setDefaultTabStatuses(tab.id);

        return tab;
    }

    // tslint:disable-next-line:no-unused-variable
    private onWarning(message: any) {
        this.notificationsService.alert(message.header, message.body);
    }

    // tslint:disable-next-line:no-unused-variable
    private onError(message: any) {
        this.notificationsService.error(message.header, message.body);
    }

    // tslint:disable-next-line:no-unused-variable
    private onBeginResizing() {
        let overlays = document.getElementsByClassName(
            'console-resizing-overlay');
        [].forEach.call(overlays, (overlay: HTMLElement) => {
            overlay.style.display = 'block';
        });
    }

    // tslint:disable-next-line:no-unused-variable
    private onEndedResizing() {
        let overlays = document.getElementsByClassName(
            'console-resizing-overlay');
        [].forEach.call(overlays, (overlay: HTMLElement) => {
            overlay.style.display = 'none';
        });
    }

    // tslint:disable-next-line:no-unused-variable
    private initBoardExplorer(): boolean {
        this.boardExplorer.init();
        return false;
    }
}
