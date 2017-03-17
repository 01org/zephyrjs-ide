// Suppress warning TS2304 for known objects
declare const ALLOC_NORMAL: number;
declare function intArrayFromString(s: string): number[];
declare function allocate(array: number[], type: string, strategy: number): any;
declare function _convert_ihex(ptr: any): any;
declare function Pointer_stringify(ptr: any): string;
declare function _free(ptr: any): any;


export class WebUsbPort {
    device: any;
    decoder: any;
    encoder: any;
    rawMode: boolean;
    previousRead: string;

    constructor(device: any) {
        this.device = device;
        this.decoder = new (window as any).TextDecoder();
        this.encoder = new (window as any).TextEncoder('utf-8');
    }

    public onReceive(data: string) {
        // tslint:disable-next-line:no-empty
    }

    public onReceiveError(error: DOMException) {
        // tslint:disable-next-line:no-empty
    }

    public connect(): Promise<void> {
        this.rawMode = true;

        return new Promise<void>((resolve, reject) => {
            let readLoop = () => {
                this.device.transferIn(3, 64).then((result: any) => {
                    let skip = true,
                        str = this.decoder.decode(result.data);

                    if (str === 'raw') {
                        this.rawMode = true;
                    } else if (str === 'ihex') {
                        this.rawMode = false;
                    }

                    skip = !this.rawMode && /^(\n|\[.*\])/.test(str);

                    if (!skip) {
                        if (str.length === 1 &&
                            str.charCodeAt(0) !== 13 &&
                            str.charCodeAt(0) !== 10 &&
                            this.previousRead !== undefined &&
                            this.previousRead.charCodeAt(
                                this.previousRead.length - 1) === 13) {
                            str = '\n' + str;
                        }

                        this.previousRead = str;
                        this.onReceive(str);
                    }

                    readLoop();
                }, (error: DOMException) => {
                    this.onReceiveError(error);
                });
            };

            this.device.open()
            .then(() => {
                if (this.device.configuration === null) {
                    this.device.selectConfiguration(1);
                }

                this.device.claimInterface(2)
                .then(() => {
                    this.device.controlTransferOut({
                        requestType: 'class',
                        recipient: 'interface',
                        request: 0x22,
                        value: 0x01,
                        index: 0x02})
                    .then(() => {
                        readLoop();
                        resolve();
                    })
                    .catch((error: DOMException) => {
                        reject('Unable to send control data to the device');
                    });
                })
                .catch((error: DOMException) => {
                    reject('Unable to claim device interface');
                });
             })
             .catch((error: DOMException) => {
                 reject('Unable to open the device');
             });
        });
    }

    public read(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.device.transferIn(3, 64).then((response: any) => {
                let decoded = this.decoder.decode(response.data);
                resolve(decoded);
            });
        });
    }

    public send(data: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (data.length === 0) {
                reject('Empty data');
            }

            this.device.transferOut(2, this.encoder.encode(data))
            .then(() => { resolve(); })
            .catch((error: string) => { reject(error); });
        });
    }

    public run(data: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (data.length === 0) {
                reject('Empty data');
            }

            this.send('set transfer ihex\n')
                .then(() => this.send('stop\n'))
                .then(() => this.send('load\n'))
                .then(() => {
                    let ihex =
                        this.convIHex(
                            this.stripBlankLines(
                                this.stripComments(data)));

                    for (let line of ihex.split('\n')) {
                        this.send(line + '\n');
                    }
                })
                .then(() => this.send('run temp.dat\n'))
                .then(() => this.send('set transfer raw\n'))
                .then((warning: string) => resolve(warning))
                .catch((error: string) => reject(error));
        });
    }

    private convIHex(source: string): string {
      let array = intArrayFromString(source);
      let ptr = allocate(array, 'i8', ALLOC_NORMAL);
      let output = _convert_ihex(ptr);
      let iHexString = Pointer_stringify(output);
      _free(ptr);
      return iHexString;
    }

    private stripComments(source: string): string {
      return source.replace(RegExp('[ \t]*//.*', 'g'), '');
    }

    private stripBlankLines(source: string): string {
      return source.replace(RegExp('^[ \t]*\n', 'gm'), '');
    }
}
