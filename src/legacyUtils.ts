import { init } from '..';
import { rl } from '../menu/menu';
import { FileUtils } from './utils/fileUtils';
import { AsyncUtils } from './utils/asyncUtils';

/**
 * Legacy utility functions - kept for backward compatibility
 * These will be gradually migrated to the new structure
 */

export const sleep = AsyncUtils.sleep;

export const mainMenuWaiting = () => {
  rl.question('press Enter key to continue', (answer: string) => {
    init();
  });
};

export const readCreatorWallet = FileUtils.readCreatorWallet;
export const readMintAddrFromFile = FileUtils.readMintAddrFromFile;

