import { Reducer } from 'redux';
import * as actions from './actions';
import { ActionType, getType } from 'typesafe-actions';
import { getInventoryWishListRolls } from './wishlists';
import { RootState, ThunkResult } from '../store/reducers';
import _ from 'lodash';
import { observeStore } from '../utils/redux-utils';
import { set, get } from 'idb-keyval';
import { WishListAndInfo } from './types';
import { createSelector } from 'reselect';
import { storesSelector } from '../inventory/selectors';
import { fetchWishList } from './wishlist-fetch';

export const wishListsSelector = (state: RootState) => state.wishLists;

export const wishListsLastFetchedSelector = (state: RootState) =>
  wishListsSelector(state).lastFetched;

const wishListsByHashSelector = createSelector(wishListsSelector, (wls) =>
  _.groupBy(wls.wishListAndInfo.wishListRolls?.filter(Boolean), (r) => r.itemHash)
);

export const wishListsEnabledSelector = (state: RootState) =>
  (wishListsSelector(state)?.wishListAndInfo?.wishListRolls?.length || 0) > 0;

export const inventoryWishListsSelector = createSelector(
  storesSelector,
  wishListsByHashSelector,
  getInventoryWishListRolls
);

export interface WishListsState {
  loaded: boolean;
  wishListAndInfo: WishListAndInfo;
  lastFetched?: Date;
}

export type WishListAction = ActionType<typeof actions>;

const initialState: WishListsState = {
  loaded: false,
  wishListAndInfo: { title: undefined, description: undefined, wishListRolls: [] },
  lastFetched: undefined
};

export const wishLists: Reducer<WishListsState, WishListAction> = (
  state: WishListsState = initialState,
  action: WishListAction
) => {
  switch (action.type) {
    case getType(actions.loadWishLists):
      return {
        ...state,
        wishListAndInfo: action.payload.wishList,
        loaded: true,
        lastFetched: action.payload.lastFetched || new Date()
      };
    case getType(actions.clearWishLists): {
      return {
        ...state,
        wishListAndInfo: {
          title: undefined,
          description: undefined,
          wishListRolls: []
        },
        lastFetched: undefined
      };
    }
    default:
      return state;
  }
};

export function saveWishListToIndexedDB() {
  return observeStore(
    (state) => state.wishLists,
    (_, nextState) => {
      if (nextState.loaded) {
        set('wishlist', {
          wishListAndInfo: nextState.wishListAndInfo,
          lastFetched: nextState.lastFetched
        });
      }
    }
  );
}

export function loadWishListAndInfoFromIndexedDB(): ThunkResult {
  return async (dispatch, getState) => {
    if (getState().wishLists.loaded) {
      return;
    }

    const wishListState = await get<WishListsState>('wishlist');

    if (getState().wishLists.loaded) {
      return;
    }

    // easing the transition from the old state (just an array) to the new state
    // (object containing an array)
    if (Array.isArray(wishListState?.wishListAndInfo?.wishListRolls)) {
      dispatch(
        actions.loadWishLists({
          wishList: {
            title: undefined,
            description: undefined,
            wishListRolls: wishListState.wishListAndInfo.wishListRolls
          },
          lastFetched: wishListState.lastFetched
        })
      );
    }

    // Refresh the wish list from source if necessary
    dispatch(fetchWishList());
  };
}
