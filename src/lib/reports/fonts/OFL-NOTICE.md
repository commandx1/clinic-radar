# Noto Sans — font kaynağı ve lisans

`NotoSans-Regular.ttf` ve `NotoSans-Bold.ttf`, Google'ın resmi font deposundaki
(`google/fonts`, `ofl/notosans/NotoSans[wdth,wght].ttf`) değişken Noto Sans
fontundan `fonttools varLib.instancer` ile Regular (wght=400) ve Bold (wght=700)
statik enstantaneler çıkarılıp, yalnızca Latin + Latin Extended-A + genel
noktalama Unicode aralığına (`U+0000-024F,U+2000-206F,U+20AC`) `fonttools
subset` ile küçültülerek üretildi. Amaç: Türkçe alfabenin (ı, ş, ğ, ç, ö, ü ve
büyük harfli karşılıkları) TEK bir gömülü fontta eksiksiz render edilmesi —
react-pdf'in varsayılan Helvetica'sı ve Google Fonts'un CDN'den ayrı
"latin"/"latin-ext" alt kümeleri bunu tek dosyada sağlamıyordu.

Noto Sans, [SIL Open Font License 1.1](https://openfontlicense.org/) ile
lisanslıdır — türetilmiş/subset'lenmiş halinin dağıtımı serbesttir.
