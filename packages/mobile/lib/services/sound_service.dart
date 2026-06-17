import 'package:flutter/foundation.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class SoundService {
  static final SoundService _instance = SoundService._internal();
  factory SoundService() => _instance;
  SoundService._internal();

  AudioPlayer? _kitchenPlayer;
  AudioPlayer? _staffPlayer;
  bool _isAudioUnlocked = false;

  Future<void> init() async {
    // Skip audio on web platform
    if (kIsWeb) {
      debugPrint('SoundService: Skipping init on web platform');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    _isAudioUnlocked = prefs.getBool('audio_unlocked') ?? false;

    try {
      _kitchenPlayer = AudioPlayer();
      _staffPlayer = AudioPlayer();

      // Pre-load audio
      await _kitchenPlayer!.setSource(AssetSource('sounds/notification.mp3'));
      await _staffPlayer!.setSource(AssetSource('sounds/staff_call.mp3'));

      await _kitchenPlayer!.setVolume(0.6);
      await _staffPlayer!.setVolume(0.8);
    } catch (e) {
      debugPrint('SoundService init error: $e');
    }
  }

  Future<void> unlockAudio() async {
    if (kIsWeb) return;

    _isAudioUnlocked = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('audio_unlocked', true);
    // Play a silent audio to unlock AudioContext on iOS
    try {
      await _kitchenPlayer?.play(AssetSource('sounds/notification.mp3'));
      await _kitchenPlayer?.stop();
    } catch (e) {
      debugPrint('Unlock audio error: $e');
    }
  }

  bool get isAudioUnlocked => _isAudioUnlocked;

  /// Play kitchen notification sound (3x at intervals)
  Future<void> playKitchenSound() async {
    if (kIsWeb || !_isAudioUnlocked || _kitchenPlayer == null) return;
    try {
      // Play 3 times with delay
      await _kitchenPlayer!.seek(Duration.zero);
      await _kitchenPlayer!.resume();
      await Future.delayed(const Duration(milliseconds: 600));
      await _kitchenPlayer!.seek(Duration.zero);
      await _kitchenPlayer!.resume();
      await Future.delayed(const Duration(milliseconds: 600));
      await _kitchenPlayer!.seek(Duration.zero);
      await _kitchenPlayer!.resume();
    } catch (e) {
      debugPrint('Kitchen sound error: $e');
    }
  }

  /// Play staff call notification sound (3x at intervals)
  Future<void> playStaffCallSound() async {
    if (kIsWeb || !_isAudioUnlocked || _staffPlayer == null) return;
    try {
      await _staffPlayer!.seek(Duration.zero);
      await _staffPlayer!.resume();
      await Future.delayed(const Duration(milliseconds: 800));
      await _staffPlayer!.seek(Duration.zero);
      await _staffPlayer!.resume();
      await Future.delayed(const Duration(milliseconds: 800));
      await _staffPlayer!.seek(Duration.zero);
      await _staffPlayer!.resume();
    } catch (e) {
      debugPrint('Staff call sound error: $e');
    }
  }

  /// Play ready to serve notification
  Future<void> playReadySound() async {
    if (kIsWeb || !_isAudioUnlocked || _staffPlayer == null) return;
    try {
      await _staffPlayer!.seek(Duration.zero);
      await _staffPlayer!.resume();
    } catch (e) {
      debugPrint('Ready sound error: $e');
    }
  }

  Future<void> dispose() async {
    await _kitchenPlayer?.dispose();
    await _staffPlayer?.dispose();
  }
}