import { get } from '@vueuse/core';
import { ContentNodeResource, ContentNodeProgressResource } from 'kolibri.resources';
import samePageCheckGenerator from 'kolibri.utils.samePageCheckGenerator';
import router from 'kolibri.coreVue.router';
import { PageNames } from '../../constants';
import useChannels from '../../composables/useChannels';
import { _collectionState, normalizeContentNode, contentState } from '../coreLearn/utils';

const { channelsMap } = useChannels();

export function showTopicsContent(store, id) {
  store.commit('CORE_SET_PAGE_LOADING', true);
  store.commit('SET_PAGE_NAME', PageNames.TOPICS_CONTENT);

  ContentNodeResource.fetchModel({ id }).only(
    samePageCheckGenerator(store),
    content => {
      const currentChannel = get(channelsMap)[content.channel_id];
      if (!currentChannel) {
        router.replace({ name: PageNames.CONTENT_UNAVAILABLE });
        return;
      }
      store.commit('topicsTree/SET_STATE', {
        content: contentState(content),
        channel: currentChannel,
      });
      store.commit('CORE_SET_PAGE_LOADING', false);
      store.commit('CORE_SET_ERROR', null);
    },
    error => {
      store.dispatch('handleApiError', error);
    }
  );
}

export function showTopicsTopic(store, { id, pageName }) {
  return store.dispatch('loading').then(() => {
    store.commit('SET_PAGE_NAME', pageName);
    return ContentNodeResource.fetchTree({
      id,
      params: {
        include_coach_content:
          store.getters.isAdmin || store.getters.isCoach || store.getters.isSuperuser,
      },
    }).only(
      samePageCheckGenerator(store),
      topic => {
        const currentChannel = get(channelsMap)[topic.channel_id];
        if (!currentChannel) {
          router.replace({ name: PageNames.CONTENT_UNAVAILABLE });
          return;
        }
        const isRoot = !topic.parent;
        if (isRoot) {
          topic.description = currentChannel.description;
          topic.tagline = currentChannel.tagline;
          topic.thumbnail = currentChannel.thumbnail;
        }
        const children = topic.children.results || [];

        if (!children.some(c => !c.is_leaf) && pageName !== PageNames.TOPICS_TOPIC_SEARCH) {
          router.replace({ name: PageNames.TOPICS_TOPIC_SEARCH, id });
          store.commit('SET_PAGE_NAME', PageNames.TOPICS_TOPIC_SEARCH);
        }

        store.commit('topicsTree/SET_STATE', {
          isRoot,
          channel: currentChannel,
          topic: normalizeContentNode(topic),
          contents: _collectionState(children),
        });

        // Only load contentnode progress if the user is logged in
        if (store.getters.isUserLoggedIn) {
          if (children.length > 0) {
            ContentNodeProgressResource.fetchCollection({
              getParams: { parent: id },
            }).then(progresses => {
              store.commit('topicsTree/SET_NODE_PROGRESS', progresses);
            });
          }
        }

        store.dispatch('notLoading');
        store.commit('CORE_SET_ERROR', null);
      },
      error => {
        store.dispatch('handleApiError', error);
      }
    );
  });
}
