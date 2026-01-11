from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)

tts.tts_to_file(
    text="Çok yakında bir düşünce, bir dosya gibi bilgisayara aktarılabilir… hatta zihinler arasında paylaşılabilir hale gelebilir. Beyin–bilgisayar arayüzleri bugün felçli bireylere hareket yetisi kazandırıyor ve düşünceyle cihaz kontrolünü mümkün kılıyor. Bu teknoloji insan deneyiminin sınırlarını yeniden tanımlayabilir; iletişim, hareket ve yaratıcılık kavramlarını kökten değiştirebilir. Ama aynı zamanda zihinsel gizlilik, hafıza bütünlüğü ve kimlik algısı için tarihte eşi görülmemiş riskler de barındırıyor. İnsanlığın en mahrem alanı olan zihin… gelecekte gerçekten korunabilecek mi?",
    speaker_wav="voice_samples/gdhspor_ses.wav",
    language="tr",  # Sadece bunu değiştir!.
    file_path="voice_samples/gdhspor_ses_new_v1.wav"
)

print("✅ Türkçe klonlama tamamlandı!")