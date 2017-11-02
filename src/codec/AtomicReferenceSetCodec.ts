/* tslint:disable */
import ClientMessage = require('../ClientMessage');
import {BitsUtil} from '../BitsUtil';
import Address = require('../Address');
import {AddressCodec} from './AddressCodec';
import {UUIDCodec} from './UUIDCodec';
import {MemberCodec} from './MemberCodec';
import {Data} from '../serialization/Data';
import {EntryViewCodec} from './EntryViewCodec';
import DistributedObjectInfoCodec = require('./DistributedObjectInfoCodec');
import {AtomicReferenceMessageType} from './AtomicReferenceMessageType';

var REQUEST_TYPE = AtomicReferenceMessageType.ATOMICREFERENCE_SET;
var RESPONSE_TYPE = 100;
var RETRYABLE = false;


export class AtomicReferenceSetCodec {


    static calculateSize(name: string, newValue: Data) {
// Calculates the request payload size
        var dataSize: number = 0;
        dataSize += BitsUtil.calculateSizeString(name);
        dataSize += BitsUtil.BOOLEAN_SIZE_IN_BYTES;
        if (newValue !== null) {
            dataSize += BitsUtil.calculateSizeData(newValue);
        }
        return dataSize;
    }

    static encodeRequest(name: string, newValue: Data) {
// Encode request into clientMessage
        var clientMessage = ClientMessage.newClientMessage(this.calculateSize(name, newValue));
        clientMessage.setMessageType(REQUEST_TYPE);
        clientMessage.setRetryable(RETRYABLE);
        clientMessage.appendString(name);
        clientMessage.appendBoolean(newValue === null);
        if (newValue !== null) {
            clientMessage.appendData(newValue);
        }
        clientMessage.updateFrameLength();
        return clientMessage;
    }

// Empty decodeResponse(ClientMessage), this message has no parameters to decode


}