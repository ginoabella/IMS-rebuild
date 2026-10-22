"""Pure, report-only reconciliation of safe trunk owner/material projections.
No connections, plaintext material, latest-version selection, repair or activation.
The caller must establish inventory completeness and an isolated restore scope.
"""
import hashlib
import uuid

IDENTITY = ('installationId','bindingId','peerId','generationId','operationId',
            'generationOrdinal','materialVersion','purposes')


def valid_uuid(value):
    try:return isinstance(value,str) and str(uuid.UUID(value))==value
    except ValueError:return False


def identity(value):
    if not isinstance(value,dict) or any(not valid_uuid(value.get(k)) for k in IDENTITY[:5]):
        raise ValueError('invalid_inventory')
    if type(value.get('generationOrdinal')) is not int or not 0<value['generationOrdinal']<=2147483647 or type(value.get('materialVersion')) is not int or value.get('materialVersion')!=1:
        raise ValueError('invalid_inventory')
    if value.get('purposes') not in [['outbound-request'],['registration'],['outbound-request','registration']]:
        raise ValueError('invalid_inventory')
    return tuple(tuple(value[k]) if k=='purposes' else value[k] for k in IDENTITY)


def verify_pair(checkpoint,postgres,snapshot,expected_operation):
    if (not isinstance(checkpoint,dict) or checkpoint.get('fixtureOnly') is not True or checkpoint.get('format')!=1 or
            checkpoint.get('operationId')!=expected_operation or not valid_uuid(expected_operation) or
            checkpoint.get('quiescedFixtureWrites') is not True or
            not isinstance(postgres,bytes) or not isinstance(snapshot,bytes) or not postgres or not snapshot or
            any(checkpoint.get(k)!=hashlib.sha256(data).hexdigest() for k,data in [('postgresSha256',postgres),('openbaoSha256',snapshot)])):
        raise ValueError('checkpoint_pair_mismatch')
    return {'status':'fixture-pair-integrity-verified','operationId':expected_operation,'retainedRestoreAuthorized':False}


def reconcile(postgres,provider,*,complete=False):
    report={'status':'identity-reconciliation-report','scope':'trunk-owner-foundation-only',
            'identityReconciliationPassed':False,'runtimeUseAllowed':False,'writesPerformed':0,'differences':[]}
    if complete is not True:
        report['differences']=[{'code':'inventory-unavailable-or-incomplete'}];return report
    try:
        if not isinstance(postgres,list) or not isinstance(provider,list) or len(postgres)>10000 or len(provider)>10000:
            raise ValueError('invalid_inventory')
        owners={};materials={}
        for row in postgres:
            if set(row)!=set(IDENTITY)|{'nodeId','ownerRevision','reservationState'} or not valid_uuid(row['nodeId']) or type(row['ownerRevision']) is not int or row['ownerRevision']<1 or row['reservationState'] not in ['reserved','cancelled','failed']:
                raise ValueError('invalid_inventory')
            identity(row);key=(row['installationId'],row['bindingId'],row['generationId'])
            if key in owners:raise ValueError('duplicate_inventory')
            owners[key]=row
        for row in provider:
            if set(row)!=set(IDENTITY)|{'providerVersion','destroyed','deletionTime'} or type(row['providerVersion']) is not int or row['providerVersion']<1 or type(row['destroyed']) is not bool or not isinstance(row['deletionTime'],str):
                raise ValueError('invalid_inventory')
            identity(row);key=(row['installationId'],row['bindingId'],row['generationId'])
            if key in materials:raise ValueError('duplicate_inventory')
            materials[key]=row
    except (ValueError,TypeError,KeyError):
        report['differences']=[{'code':'malformed-or-duplicate-inventory'}];return report
    matched=0
    for key in sorted(owners.keys()|materials.keys()):
        owner=owners.get(key);material=materials.get(key)
        codes=[]
        if owner is None:codes.append('material-without-owner')
        if material is None:codes.append('owner-without-material')
        if material:
            if material['providerVersion']!=1:codes.append('provider-version-not-one')
            if material['destroyed']:codes.append('material-destroyed')
            if material['deletionTime']:codes.append('material-deleted')
        if owner and material and identity(owner)!=identity(material):codes.append('identity-mismatch')
        if codes:
            report['differences'].append({'installationId':key[0],'bindingId':key[1],'generationId':key[2],'codes':codes})
        else:matched+=1
    report.update(ownerCount=len(owners),materialCount=len(materials),matched=matched,
        identityReconciliationPassed=not report['differences'])
    return report
