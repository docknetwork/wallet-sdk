import {addDelegationChain, getDelegationChain} from './delegation-chain';

describe('getDelegationChain', () => {
  it('looks up the chain document by `${credential.id}#delegationChain`', async () => {
    const wallet = {
      addDocument: jest.fn(),
      getDocument: jest.fn().mockResolvedValue(null),
    };

    await getDelegationChain({id: 'cred-123'}, wallet);

    expect(wallet.getDocument).toHaveBeenCalledWith('cred-123#delegationChain');
  });
});

describe('addDelegationChain', () => {
  it('stores a chain document when none exists for the credential', async () => {
    const wallet = {
      addDocument: jest.fn(),
      getDocument: jest.fn().mockResolvedValue(null),
    };
    const credential = {id: 'cred-123'};
    const delegationChain = [credential];

    const stored = await addDelegationChain(
      credential,
      delegationChain,
      wallet,
    );

    expect(wallet.addDocument).toHaveBeenCalledTimes(1);
    const [storedDoc] = wallet.addDocument.mock.calls[0];
    expect(storedDoc).toMatchObject({
      id: 'cred-123#delegationChain',
      type: 'DelegationChain',
      credentialId: 'cred-123',
      delegationChain,
    });
    expect(stored).toBe(storedDoc);
  });

  it('throws and does not write when a chain already exists', async () => {
    const wallet = {
      addDocument: jest.fn(),
      getDocument: jest.fn().mockResolvedValue({
        id: 'cred-123#delegationChain',
        type: 'DelegationChain',
      }),
    };

    await expect(
      addDelegationChain({id: 'cred-123'}, [], wallet),
    ).rejects.toThrow(/already exists/i);

    expect(wallet.addDocument).not.toHaveBeenCalled();
  });
});
