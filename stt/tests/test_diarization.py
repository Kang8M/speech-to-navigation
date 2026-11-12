import numpy as np
import pytest

from stt.diarization import SpeakerProfiles, Region, tokens_to_words, attribute_words


def test_bpe_tokens_become_timed_words_without_losing_word_fragments():
    words = tokens_to_words([' TÔI', ' BỊ', ' AM', 'OX', 'ICILLIN'], [0, 1, 2, 2.2, 2.5], 3)
    assert [word['text'] for word in words] == ['tôi', 'bị', 'amoxicillin']
    assert words[-1]['start_ms'] == 2000
    assert words[-1]['end_ms'] == 3000


def test_profiles_stay_stable_when_local_cluster_order_swaps():
    profiles = SpeakerProfiles()
    a, b = np.array([1., 0, 0]), np.array([0., 1, 0])
    assert profiles.identify(a) == 1
    assert profiles.identify(b) == 2
    assert profiles.identify(b) == 2
    assert profiles.identify(a) == 1
    assert profiles.identify(np.array([0., 0, 1])) is None


def test_words_follow_speaker_changes_inside_one_chunk_and_overlap_is_unknown():
    regions = [Region(0, 2, 1), Region(2, 4, 2), Region(4, 5, 1), Region(4.5, 5, 2)]
    words = tokens_to_words([' A', ' B', ' C', ' D'], [0.5, 2.2, 4.1, 4.6], 5)
    attributed = attribute_words(words, regions)
    assert [word['speaker'] for word in attributed] == [1, 2, 1, None]
    assert attributed[-1]['overlap'] is True


def test_unknown_region_never_inherits_the_previous_speaker():
    words = tokens_to_words([' CHƯA', ' RÕ'], [0, 1], 2)
    output = attribute_words(words, [Region(0, 2, None)])
    assert all(word['speaker'] is None for word in output)


def test_overlap_is_preserved_even_when_both_voices_are_unknown_or_map_to_same_id():
    words = tokens_to_words([' CHÀO'], [0.8], 2)
    for regions in ([Region(0, 2, None), Region(0.5, 1.5, None)],
                    [Region(0, 2, 1, cluster=0), Region(0.5, 1.5, 1, cluster=1)]):
        result = attribute_words(words, regions)[0]
        assert result['speaker'] is None
        assert result['overlap'] is True
