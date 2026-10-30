import React from 'react';
import { useProtectTrainingDraft, useTrainingDraftGuard } from '../useTrainingDraftGuard';
const { create, act } = require('react-test-renderer');
let protectedDraft = false;
function Observer() { protectedDraft = useTrainingDraftGuard(); return null; }
function Editor({ active }: { active: boolean }) { useProtectTrainingDraft(active); return null; }
it('protects tab reselection while any editor owns a draft and releases every subscription on unmount', async () => {
  let tree: any;
  const render = (first: boolean, second: boolean) => <><Observer /><Editor active={first} /><Editor active={second} /></>;
  await act(async () => { tree = create(render(false, false)); }); expect(protectedDraft).toBe(false);
  await act(async () => tree.update(render(true, true))); expect(protectedDraft).toBe(true);
  await act(async () => tree.update(render(false, true))); expect(protectedDraft).toBe(true);
  await act(async () => tree.update(render(false, false))); expect(protectedDraft).toBe(false);
  await act(async () => tree.update(render(true, false))); expect(protectedDraft).toBe(true);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Observer />); }); expect(protectedDraft).toBe(false);
  await act(async () => tree.unmount());
});
