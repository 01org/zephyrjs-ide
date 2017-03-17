import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild
} from '@angular/core';

import { GitHubModalComponent } from '../github/github.modal.component';
import { WebUsbPort } from '../../../../shared/webusb/webusb.port';
import { WebUsbService } from '../../../../shared/webusb/webusb.service';
import { EditorTab, OPERATION_STATUS, EDITOR_STATUS } from '../../editor.tab';


declare const monaco: any;


@Component({
    moduleId: module.id,
    selector: 'sd-monaco',
    providers: [WebUsbService],
    templateUrl: 'monaco.component.html',
    styleUrls: ['monaco.component.css']
})
export class MonacoComponent implements AfterViewInit {
    @Input('tab') tab: EditorTab;
    @Output() onWarning = new EventEmitter();
    @Output() onError = new EventEmitter();

    @ViewChild('editor')
    private editorView: ElementRef;

    @ViewChild('gitHubModal')
    private gitHubModal: GitHubModalComponent;

    private initialCode: string = '';

    constructor(private webusbService: WebUsbService) {
    }

    public ngAfterViewInit() {
        var onGotAmdLoader = () => {
            // Load monaco
            (<any>window).require.config({ paths: { 'vs': 'libs/monaco/vs' } });
            (<any>window).require(['vs/editor/editor.main'], () => {
                this.initMonaco();
            });
        };

        // Load AMD loader if necessary
        // WARNING: this will 404 doing unit tests. It's fine.
        if (!(<any>window).require) {
            var loaderScript = document.createElement('script');
            loaderScript.type = 'text/javascript';
            loaderScript.src = 'libs/monaco/vs/loader.js';
            loaderScript.addEventListener('load', onGotAmdLoader);
            document.body.appendChild(loaderScript);
        } else {
            onGotAmdLoader();
        }

        if (this.webusbService.usb === undefined) {
            this.onError.emit({
                body: 'Your browser does not support WebUSB',
                sticky: true
            });
        }
    }

    // Will be called once monaco library is available
    public initMonaco() {
        if (this.tab === null) {
            throw('You need to construct the monaco component with a tab');
        }

        let theme = 'vs-dark';
        let model = null;

        if (monaco.editor.defineTheme !== undefined) {
            monaco.editor.defineTheme('web-ide', {
                base: theme,
                inherit: true,
                rules: []
            });
            theme = 'web-ide';
        }

        if (this.tab.editor !== null) {
            model = this.tab.editor.getModel();
        }

        this.tab.editor = monaco.editor.create(this.editorView.nativeElement, {
            value: this.initialCode,
            language: 'javascript',
            automaticLayout: true,
            theme: theme
        });

        if (model !== null) {
            this.tab.editor.setModel(model);
        }
    }

    // tslint:disable-next-line:no-unused-locals
    public mayConnect(): boolean {
        return this.webusbService.usb !== undefined &&
               this.tab.connectionStatus === OPERATION_STATUS.NOT_STARTED ||
               this.tab.connectionStatus === OPERATION_STATUS.ERROR;
    }

    // tslint:disable-next-line:no-unused-locals
    public onConnect() {
        this.tab.connectionStatus = OPERATION_STATUS.IN_PROGRESS;
        this.tab.editorStatus = EDITOR_STATUS.CONNECTING;

        let doConnect = () => {
            this.webusbService.onReceive = (data: string) => {
                this.tab.term.io.print(data);
            };

            this.webusbService.onReceiveError = (error: string) => {
                this.tab.editorStatus = EDITOR_STATUS.READY;
                this.tab.connectionStatus = OPERATION_STATUS.ERROR;
                this.tab.port = null;
                this.onError.emit({
                    header: 'Connection error',
                    body: error.message
                });
            };

            this.webusbService.connect(this.tab.port)
            .then(() => {
                this.tab.connectionStatus = OPERATION_STATUS.DONE;
                this.tab.editorStatus = EDITOR_STATUS.READY;
            })
            .catch((error: string) => {
                this.tab.connectionStatus = OPERATION_STATUS.ERROR;
                this.tab.port = null;
                this.onError.emit({
                    header: 'Connection failed',
                    body: error
                });
            });
        };

        if (this.tab.port !== null) {
            doConnect();
        } else {
            this.webusbService.requestPort()
            .then((port: WebUsbPort) => {
                this.tab.port = port;
                doConnect();
            })
            .catch((error: DOMException) => {
                this.tab.connectionStatus = OPERATION_STATUS.NOT_STARTED;
                this.onError.emit({
                    header: 'Conneciton failed',
                    body: error.message
                });
            });
        }
    }

    // tslint:disable-next-line:no-unused-locals
    public mayUpload(): boolean {
        return this.webusbService.usb !== undefined &&
               this.tab.connectionStatus === OPERATION_STATUS.DONE &&
               this.tab.editor.getValue().length > 0 &&
               this.tab.uploadStatus !== OPERATION_STATUS.IN_PROGRESS &&
               this.tab.port !== null;
    }

    // tslint:disable-next-line:no-unused-locals
    public onUpload() {
        this.tab.uploadStatus = OPERATION_STATUS.IN_PROGRESS;
        this.tab.editorStatus = EDITOR_STATUS.UPLOADING;

        this.tab.port.run(this.tab.editor.getValue())
        .then((warning: string) => {
            this.tab.uploadStatus = OPERATION_STATUS.DONE;
            this.tab.editorStatus = EDITOR_STATUS.READY;

            if (warning !== undefined) {
                this.onWarning.emit({
                    header: 'Upload failed',
                    body: warning
                });
            }
        })
        .catch((error: DOMException) => {
            this.tab.connectionStatus = OPERATION_STATUS.NOT_STARTED;
            this.tab.uploadStatus = OPERATION_STATUS.NOT_STARTED;
            this.tab.editorStatus = EDITOR_STATUS.READY;
            this.onError.emit({
                header: 'Upload failed',
                body: error.message
            });
        });
    }

    // tslint:disable-next-line:no-unused-locals
    public onFetchFromGitHub() {
        this.gitHubModal.show();
    }

    // tslint:disable-next-line:no-unused-locals
    public onGitHubFileFetched(content: string) {
        this.tab.editor.setValue(content);
    }
}
