// Load document data directly from the synced JSON file
#let document_name = sys.inputs.at("document_name", default: "ikoka-stick")
#let data = json("../../src/content/documents/" + document_name + ".json")

#import "@preview/nerd-icons:0.2.0": change-nerd-font, nf-icon
#import "@preview/pyrunner:0.3.0" as py

#let parse-iso-to-utc(s) = {
  let compiled = py.compile(
    ```python
    from datetime import datetime, timezone
    def parse_iso_to_utc(iso_string: str) -> dict[str, int]:
        # Replace Z with +00:00 for proper ISO format parsing
        if iso_string.endswith('Z'):
            iso_string = iso_string[:-1] + '+00:00'
        dt = datetime.fromisoformat(iso_string)
        dt = dt.astimezone(timezone.utc)
        return {
            "year": dt.year,
            "month": dt.month,
            "day": dt.day,
            "hour": dt.hour,
            "minute": dt.minute,
            "second": dt.second
        }
    ```,
  )
  let (year, month, day, hour, minute, second) = py.call(compiled, "parse_iso_to_utc", s)
  datetime(year: year, month: month, day: day, hour: hour, minute: minute, second: second)
}

#set document(
  title: data.title,
  author: data.userData.author.name,
)

// Technical blue color scheme
#let primary-blue = rgb("#1e40af")
#let background-blue = rgb("#f1f5f9")
#let accent-red = rgb("#dc2626")
#let grid-gray = rgb("#9ca3af")
#let text-dark = rgb("#1f2937")

#set page(
  width: 8.5in,
  height: 10.5in,
  margin: (x: 0.25in, y: 0.25in),
)

// #change-nerd-font("Ubuntu Nerd Font")
#set text(font: "Ubuntu Nerd Font", size: 12pt, fill: text-dark)

// Central vertical divider line (80% height, centered vertically)
#place(top + center, dx: -0.75in, dy: 0.5in, line(
  length: 85%,
  angle: 90deg,
  stroke: 1pt + grid-gray,
))

// Main content area with two-column layout
#grid(
  columns: (3in, 1fr),
  column-gutter: 0.7in,

  // LEFT COLUMN - Designer Info
  [
    // Circular designer photo
    #align(center)[
      #let photo_size = 2.2in
      // Create circular clipping mask using circle with image fill
      #circle(
        radius: photo_size / 2,
        fill: tiling(image("../../public/images/andyshinn.png", width: photo_size, height: photo_size, fit: "cover")),
        stroke: 0pt,
      )
    ]

    #v(16pt)

    // Designer Details
    // #set text(size: 10pt, weight: "regular")
    #set align(center)
    #text(weight: "bold")[#data.userData.author.name]#linebreak()


    #set align(left)
    #text[
      Thank you for taking a look at my model! I make my own models and often times reproduce existing parts in CAD so that I can model in-context. I hope you find this model useful for your own projects. Please find more of my models at #link("https://myshapes.andyshinn.as")[myshapes.andyshinn.as] or on my GitHub at #link("https://github.com/andyshinn/myshapes")[github.com/andyshinn/myshapes].

      #v(20pt)

      This is a generated PDF and should have any special information about this document on the right. If you find any issues or have suggestions, please feel free to reach out. I appreciate any feedback and contributions to improve the model.
    ]

    #v(20pt)

    // Contact Information
    #text(size: 10pt)[
      #table(
        columns: (auto, 1fr),
        align: left,
        stroke: none,
        inset: 3pt,

        [#nf-icon("email", fill: green) Email], link("mailto:" + data.userData.author.email)[#data.userData.author.email],
        [#nf-icon("web", fill: orange) Website], link("https://" + data.userData.author.website)[#data.userData.author.website],

        [#nf-icon("github") GitHub], link("https://github.com/andyshinn")[github.com/andyshinn],
        [#nf-icon("discord", fill: rgb("#5865F2")) Discord], link("https://discordapp.com/users/andyshinn")[andyshinn],
        [#nf-icon("youtube", fill: red) YouTube], link("https://www.youtube.com/@andyshinn")[youtube.com/\@andyshinn],
      )
    ]
  ],

  // RIGHT COLUMN - Technical Details & Model
  [
    #set text(size: 10pt)

    // Model thumbnail from Onshape (75% size of 600x340)
    #align(center)[
      #let thumbnail_width = 4.5in * 0.75  // 75% of original size
      #let thumbnail_height = 2.55in * 0.75
      #let thumbnail_path = "../../src/images/" + data.documentId + "-600x340.png"
      #rect(width: thumbnail_width, height: thumbnail_height, fill: white, stroke: 0pt, inset: 4pt, [
        #if sys.inputs.at("thumbnail_exists", default: true) [
          #image(thumbnail_path, width: 100%, height: 100%, fit: "contain")
        ] else [
          #align(center + horizon, text(fill: grid-gray, size: 12pt)[No preview available])
        ]
      ])
    ]

    #v(16pt)

    // Model Information
    #text[
      = #data.title
      #text(
        size: 8pt,
        style: "italic",
        fill: grid-gray,
      )[Created #parse-iso-to-utc(data.createdAt).display("[month repr:short] [day], [year]")]

      #if data.description != "" [
        #eval(data.description, mode: "markup")
      ]
    ]

    #v(8pt)

    == Links

    - #link(data.onshapeUrl)[View on Onshape]
    - #link("https://myshapes.andyshinn.as")[View on Myshapes]

    #v(8pt)


    == Versions
    #set text(size: 8pt)
    #if data.versions.len() > 0 [
      #list(
        ..data
          .versions
          .filter(version => version.name != "Start")
          .rev()
          .map(version => [
            #text(fill: accent-red, weight: "bold")[#version.name] - #text(weight: "regular")[#parse-iso-to-utc(version.createdAt).display("[month repr:short] [day], [year]")#if version.description != "" [ - #version.description]]
          ]),
      )
    ]
  ],
)

// Optional footer (currently disabled)
#place(bottom + center, dy: -0.25in, [
  #set text(size: 8pt, fill: grid-gray)
  Generated on #datetime.today().display("[month repr:short] [day], [year]") • #link("https://github.com/andyshinn/myshapes")[github.com/andyshinn/myshapes] • #data.documentId
])
