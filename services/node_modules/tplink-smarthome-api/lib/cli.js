#!/usr/bin/env node
"use strict";
/* eslint-disable no-console */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const extra_typings_1 = require("@commander-js/extra-typings");
const lodash_castarray_1 = __importDefault(require("lodash.castarray"));
const tplinkCrypto = __importStar(require("tplink-smarthome-crypto"));
const util_1 = __importDefault(require("util"));
const index_1 = require("./index");
let logLevel;
function toInt(s) {
    return parseInt(s, 10);
}
const program = new extra_typings_1.Command()
    .option('-D, --debug', 'turn on debug level logging', () => {
    logLevel = 'debug';
})
    .option('-t, --timeout <ms>', 'timeout (ms)', toInt, 10000)
    .option('-u, --udp', 'send via UDP')
    .option('-c, --color [on]', 'output will be styled with ANSI color codes', 'on');
function outputError(err) {
    if (err instanceof index_1.ResponseError) {
        console.log('Response Error:');
        console.log(err.response);
    }
    else {
        console.error('Error:');
        console.error(err);
    }
}
function getClient() {
    const defaultSendOptions = {};
    const options = program.opts();
    if (options.udp)
        defaultSendOptions.transport = 'udp';
    if (options.timeout)
        defaultSendOptions.timeout = options.timeout;
    return new index_1.Client({ logLevel, defaultSendOptions });
}
function search(sysInfo, breakoutChildren, discoveryTimeout, broadcast, params) {
    try {
        console.log('Searching...');
        const commandParams = {
            discoveryInterval: 2000,
            discoveryTimeout,
            breakoutChildren,
            broadcast,
            ...params,
        };
        console.log(`startDiscovery(${util_1.default.inspect(commandParams)})`);
        getClient()
            .startDiscovery(commandParams)
            .on('device-new', (device) => {
            console.log(`${device.model} ${device.deviceType} ${device.type} ${device.host} ${device.port} ${device.macNormalized} ${device.deviceId} ${device.alias}`);
            if (sysInfo) {
                console.dir(device.sysInfo, {
                    colors: program.opts().color === 'on',
                    depth: 10,
                });
            }
        });
    }
    catch (err) {
        outputError(err);
    }
}
async function send(host, port, payload) {
    try {
        const client = getClient();
        console.log(`Sending to ${host}:${port || ''} via ${client.defaultSendOptions.transport}...`);
        const data = await client.send(payload, host, port);
        console.log('response:');
        console.dir(data, { colors: program.opts().color === 'on', depth: 10 });
    }
    catch (err) {
        outputError(err);
    }
}
async function sendCommand(host, port, childId, payload) {
    try {
        const client = getClient();
        console.log(`Sending to ${host}:${port || ''} ${childId ? `childId: ${childId}` : ''} via ${client.defaultSendOptions.transport}...`);
        const device = await client.getDevice({
            host,
            port,
            childId,
        });
        const results = await device.sendCommand(payload);
        console.log('response:');
        console.dir(results, { colors: program.opts().color === 'on', depth: 10 });
    }
    catch (err) {
        outputError(err);
    }
}
async function sendCommandDynamic(host, port, 
// eslint-disable-next-line @typescript-eslint/ban-types
command, commandParams = [], sendOptions, childId) {
    try {
        const client = getClient();
        console.log(`Sending ${command} command to ${host}:${port || ''} ${childId ? `childId: ${childId}` : ''} via ${sendOptions && sendOptions.transport
            ? sendOptions.transport
            : client.defaultSendOptions.transport}...`);
        const device = await client.getDevice({ host, port, childId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const func = device[command];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const results = await func.apply(device, [
            ...commandParams,
            { ...sendOptions },
        ]);
        console.log('response:');
        console.dir(results, { colors: program.opts().color === 'on', depth: 10 });
    }
    catch (err) {
        outputError(err);
    }
}
async function details(host, port) {
    try {
        console.log(`Getting details from ${host}:${port || ''}...`);
        const device = await getClient().getDevice({ host, port });
        console.dir({
            alias: device.alias,
            deviceId: device.deviceId,
            description: device.description,
            model: device.model,
            deviceType: device.deviceType,
            type: device.type,
            softwareVersion: device.softwareVersion,
            hardwareVersion: device.hardwareVersion,
            mac: device.mac,
        }, { colors: program.opts().color === 'on', depth: 10 });
    }
    catch (err) {
        outputError(err);
    }
}
function blink(host, port, times, rate) {
    console.log(`Sending blink commands to ${host}:${port ?? ''}...`);
    return getClient()
        .getDevice({ host, port })
        .then((device) => {
        return device.blink(times, rate).then(() => {
            console.log('Blinking complete');
        });
    })
        .catch((reason) => {
        outputError(reason);
    });
}
function getScanInfo(host, port, refresh, timeoutInSeconds) {
    console.log(`Sending getScanInfo command to ${host}:${port || ''}...`);
    getClient()
        .getDevice({ host, port })
        .then((device) => {
        return device.netif
            .getScanInfo(refresh, timeoutInSeconds)
            .then((value) => {
            console.dir(value);
        });
    })
        .catch((reason) => {
        outputError(reason);
    });
}
function toBoolean(s) {
    return s === 'true' || s === '1';
}
function setParamTypes(params, commandSetup) {
    if (params &&
        params.length > 0 &&
        commandSetup.params &&
        commandSetup.params.length > 0) {
        const sParams = commandSetup.params;
        return (0, lodash_castarray_1.default)(params).map((el, i) => {
            switch (sParams[i]?.type) {
                case 'number':
                    return +el;
                case 'boolean':
                    return toBoolean(el);
                default:
                    return el;
            }
        });
    }
    return params;
}
program
    .command('search [params]')
    .description('Search for devices')
    .option('--broadcast <address>', 'broadcast address', '255.255.255.255')
    .option('-s, --sysinfo', 'output sysInfo', false)
    .option('-b, --breakout-children', 'output children (multi-outlet plugs)', false)
    .action((params, options) => {
    let paramsObj;
    if (params) {
        console.dir(params);
        paramsObj = JSON.parse(params);
    }
    search(options.sysinfo, options.breakoutChildren, program.opts().timeout, options.broadcast, paramsObj);
});
function parseHost(hostString) {
    const [hostOnly, port] = hostString.split(':');
    if (hostOnly == null || hostOnly.length === 0)
        throw new Error('host is required');
    if (port != null && port.length > 0) {
        return [hostOnly, toInt(port)];
    }
    return [hostOnly, undefined];
}
program
    .command('send <host> <payload>')
    .description('Send payload to device (using Client.send)')
    .action((host, payload) => {
    const [hostOnly, port] = parseHost(host);
    send(hostOnly, port, payload).catch((err) => {
        outputError(err);
    });
});
program
    .command('sendCommand <host> <payload>')
    .description('Send payload to device (using Device#sendCommand)')
    .option('--childId <childId>', 'childId')
    .action((host, payload, options) => {
    const [hostOnly, port] = parseHost(host);
    sendCommand(hostOnly, port, options.childId, payload).catch((err) => {
        outputError(err);
    });
});
program.command('details <host>').action((host) => {
    const [hostOnly, port] = parseHost(host);
    details(hostOnly, port).catch((err) => {
        outputError(err);
    });
});
program
    .command('blink')
    .argument('<host>')
    .argument('[times]', '', toInt)
    .argument('[rate]', '', toInt)
    .action((host, times = 5, rate = 500) => {
    const [hostOnly, port] = parseHost(host);
    blink(hostOnly, port, times, rate).catch((err) => {
        outputError(err);
    });
});
program
    .command('getScanInfo')
    .argument('<host>')
    .argument('[refresh]', '', toBoolean)
    .argument('[timeoutInSeconds]', '', toInt)
    .action((host, refresh = true, timeoutInSeconds = 5) => {
    const [hostOnly, port] = parseHost(host);
    getScanInfo(hostOnly, port, refresh, timeoutInSeconds);
});
const commandSetup = [
    { name: 'getSysInfo', supportsChildId: true },
    { name: 'getInfo', supportsChildId: true },
    {
        name: 'setAlias',
        params: [{ name: 'alias', type: 'string' }],
        supportsChildId: true,
    },
    { name: 'getModel', supportsChildId: true },
    {
        name: 'setPowerState',
        params: [{ name: 'state', type: 'boolean' }],
        supportsChildId: true,
    },
    {
        name: 'setLocation',
        params: [
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' },
        ],
    },
    { name: 'reboot', params: [{ name: 'delay', type: 'number' }] },
    { name: 'reset', params: [{ name: 'delay', type: 'number' }] },
];
for (const command of commandSetup) {
    const paramsString = command.params
        ? command.params
            .map((p) => (p.optional ? `[${p.name}]` : `<${p.name}>`))
            .join(' ')
        : '';
    const cmd = program
        .command(`${command.name} <host>${paramsString ? ` ${paramsString}` : ''}`)
        .description(`Send ${command.name} to device (using Device#${command.name})`)
        .option('-t, --timeout <timeout>', 'timeout (ms)', toInt, 10000);
    if (command.supportsChildId) {
        cmd.option('-c, --childId <childId>', 'childId');
    }
    cmd.action(function action() {
        const [host, ...params] = this.args;
        const [hostOnly, port] = parseHost(host);
        const options = this.opts();
        const commandParams = setParamTypes(params, command);
        // // @ts-expect-error: childId is added conditionally and is optional
        const childId = options.childId || undefined;
        let sendOptions;
        if (options.timeout != null) {
            sendOptions = { timeout: options.timeout };
        }
        sendCommandDynamic(hostOnly, port, command.name, commandParams, sendOptions, childId).catch((err) => {
            outputError(err);
        });
    });
}
program
    .command('encrypt')
    .argument('<outputEncoding>')
    .argument('<input>')
    .argument('[firstKey=0xAB]', '', toInt)
    .action((outputEncoding, input, firstKey = 0xab) => {
    const outputBuf = tplinkCrypto.encrypt(input, firstKey);
    console.log(outputBuf.toString(outputEncoding));
});
program
    .command('encryptWithHeader')
    .argument('<outputEncoding>')
    .argument('<input>')
    .argument('[firstKey=0xAB]', '', toInt)
    .action((outputEncoding, input, firstKey = 0xab) => {
    const outputBuf = tplinkCrypto.encryptWithHeader(input, firstKey);
    console.log(outputBuf.toString(outputEncoding));
});
program
    .command('decrypt')
    .argument('<inputEncoding>')
    .argument('<input>')
    .argument('[firstKey=0xAB]', '', toInt)
    .action((inputEncoding, input, firstKey = 0xab) => {
    const inputBuf = Buffer.from(input, inputEncoding);
    const outputBuf = tplinkCrypto.decrypt(inputBuf, firstKey);
    console.log(outputBuf.toString());
});
program
    .command('decryptWithHeader')
    .argument('<inputEncoding>')
    .argument('<input>')
    .argument('[firstKey=0xAB]', '', toInt)
    .action((inputEncoding, input, firstKey = 0xab) => {
    const inputBuf = Buffer.from(input, inputEncoding);
    const outputBuf = tplinkCrypto.decryptWithHeader(inputBuf, firstKey);
    console.log(outputBuf.toString());
});
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=cli.js.map