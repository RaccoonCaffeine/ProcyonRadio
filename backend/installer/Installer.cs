using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Threading.Tasks;

namespace ProcyonRadioInstaller
{
    public class InstallerForm : Form
    {
        private Label titleLabel;
        private Label descLabel;
        private Label pathLabel;
        private TextBox pathTextBox;
        private Button browseButton;
        private CheckBox desktopShortcutCheck;
        private CheckBox startMenuShortcutCheck;
        private Button installButton;
        private ProgressBar progressBar;
        private Label statusLabel;
        private PictureBox logoBox;

        public InstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Instalador de ProcyonRadio";
            this.Size = new Size(520, 385);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(248, 250, 252); // Light base theme (Slate 50)
            this.ForeColor = Color.FromArgb(17, 24, 39); // Dark text (Slate 900)

            // Header Panel
            Panel headerPanel = new Panel();
            headerPanel.Location = new Point(0, 0);
            headerPanel.Size = new Size(520, 85);
            headerPanel.BackColor = Color.FromArgb(79, 70, 229); // Brand Indigo

            // Title Label (inside Header)
            titleLabel = new Label();
            titleLabel.Text = "ProcyonRadio Setup";
            titleLabel.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            titleLabel.Location = new Point(25, 18);
            titleLabel.Size = new Size(450, 30);
            titleLabel.ForeColor = Color.White;

            // Description Label (inside Header)
            descLabel = new Label();
            descLabel.Text = "Instalador oficial portable del servidor de música para FiveM / GTA Online";
            descLabel.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            descLabel.Location = new Point(25, 50);
            descLabel.Size = new Size(470, 25);
            descLabel.ForeColor = Color.FromArgb(224, 231, 255); // Light Indigo/White

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(descLabel);

            // Path Selection Label
            pathLabel = new Label();
            pathLabel.Text = "Selecciona la carpeta de instalación portable:";
            pathLabel.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            pathLabel.Location = new Point(25, 110);
            pathLabel.Size = new Size(300, 20);

            // Path TextBox
            pathTextBox = new TextBox();
            pathTextBox.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            pathTextBox.Location = new Point(25, 135);
            pathTextBox.Size = new Size(375, 23);
            pathTextBox.BackColor = Color.White;
            pathTextBox.ForeColor = Color.FromArgb(17, 24, 39);
            pathTextBox.BorderStyle = BorderStyle.FixedSingle;
            string defaultPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "ProcyonRadio");
            pathTextBox.Text = defaultPath;

            // Browse Button
            browseButton = new Button();
            browseButton.Text = "Examinar...";
            browseButton.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            browseButton.Location = new Point(410, 134);
            browseButton.Size = new Size(80, 25);
            browseButton.BackColor = Color.FromArgb(226, 232, 240); // Slate 200
            browseButton.ForeColor = Color.FromArgb(17, 24, 39);
            browseButton.FlatStyle = FlatStyle.Flat;
            browseButton.FlatAppearance.BorderSize = 0;
            browseButton.Click += BrowseButton_Click;
            
            // Hover effect for browse button
            browseButton.MouseEnter += (s, e) => browseButton.BackColor = Color.FromArgb(203, 213, 225);
            browseButton.MouseLeave += (s, e) => browseButton.BackColor = Color.FromArgb(226, 232, 240);

            // Desktop Shortcut Checkbox
            desktopShortcutCheck = new CheckBox();
            desktopShortcutCheck.Text = "Crear acceso directo en el Escritorio";
            desktopShortcutCheck.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            desktopShortcutCheck.Location = new Point(25, 180);
            desktopShortcutCheck.Size = new Size(300, 20);
            desktopShortcutCheck.Checked = true;

            // Start Menu Shortcut Checkbox
            startMenuShortcutCheck = new CheckBox();
            startMenuShortcutCheck.Text = "Crear acceso directo en el Menú Inicio";
            startMenuShortcutCheck.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            startMenuShortcutCheck.Location = new Point(25, 205);
            startMenuShortcutCheck.Size = new Size(300, 20);
            startMenuShortcutCheck.Checked = true;

            // Status Label
            statusLabel = new Label();
            statusLabel.Text = "Listo para comenzar.";
            statusLabel.Font = new Font("Segoe UI", 9, FontStyle.Italic);
            statusLabel.Location = new Point(25, 245);
            statusLabel.Size = new Size(375, 20);
            statusLabel.ForeColor = Color.FromArgb(100, 116, 139); // Slate 500

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(25, 270);
            progressBar.Size = new Size(465, 18);
            progressBar.Visible = false;

            // Install Button
            installButton = new Button();
            installButton.Text = "Instalar";
            installButton.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            installButton.Location = new Point(410, 295);
            installButton.Size = new Size(80, 32);
            installButton.BackColor = Color.FromArgb(79, 70, 229); // Brand Indigo
            installButton.ForeColor = Color.White;
            installButton.FlatStyle = FlatStyle.Flat;
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Click += InstallButton_Click;

            // Hover effect for install button
            installButton.MouseEnter += (s, e) => installButton.BackColor = Color.FromArgb(99, 102, 241);
            installButton.MouseLeave += (s, e) => installButton.BackColor = Color.FromArgb(79, 70, 229);

            // Add controls to form
            this.Controls.Add(headerPanel);
            this.Controls.Add(pathLabel);
            this.Controls.Add(pathTextBox);
            this.Controls.Add(browseButton);
            this.Controls.Add(desktopShortcutCheck);
            this.Controls.Add(startMenuShortcutCheck);
            this.Controls.Add(statusLabel);
            this.Controls.Add(progressBar);
            this.Controls.Add(installButton);
        }

        private void BrowseButton_Click(object sender, EventArgs e)
        {
            using (FolderBrowserDialog fbd = new FolderBrowserDialog())
            {
                fbd.Description = "Selecciona la carpeta donde extraer ProcyonRadio";
                fbd.SelectedPath = pathTextBox.Text;
                if (fbd.ShowDialog() == DialogResult.OK)
                {
                    pathTextBox.Text = fbd.SelectedPath;
                }
            }
        }

        private async void InstallButton_Click(object sender, EventArgs e)
        {
            string installPath = pathTextBox.Text.Trim();
            if (string.IsNullOrEmpty(installPath))
            {
                MessageBox.Show("Por favor, selecciona una ruta de instalación válida.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Disable controls during installation
            installButton.Enabled = false;
            browseButton.Enabled = false;
            pathTextBox.Enabled = false;
            desktopShortcutCheck.Enabled = false;
            startMenuShortcutCheck.Enabled = false;

            progressBar.Visible = true;
            progressBar.Style = ProgressBarStyle.Marquee;
            statusLabel.Text = "Instalando... Por favor espera.";
            statusLabel.ForeColor = Color.White;

            bool success = false;
            string errorMsg = "";

            await Task.Run(() =>
            {
                try
                {
                    // Create directory if not exists
                    if (!Directory.Exists(installPath))
                    {
                        Directory.CreateDirectory(installPath);
                    }

                    // Extract embedded ZIP file
                    Assembly assembly = Assembly.GetExecutingAssembly();
                    // The resource name in csc is usually the filename of the resource passed
                    string resourceName = "ProcyonRadio-Distribution.zip";

                    using (Stream zipStream = assembly.GetManifestResourceStream(resourceName))
                    {
                        if (zipStream == null)
                        {
                            throw new Exception("No se encontró el recurso del archivo ZIP '" + resourceName + "' dentro del instalador.");
                        }

                        // Write to a temporary file, then extract
                        string tempZipPath = Path.Combine(Path.GetTempPath(), "ProcyonRadioSetup.zip");
                        using (FileStream tempFileStream = new FileStream(tempZipPath, FileMode.Create, FileAccess.Write))
                        {
                            zipStream.CopyTo(tempFileStream);
                        }

                        // Extract using ZipFile
                        // Overwrite files if they already exist
                        using (ZipArchive archive = ZipFile.OpenRead(tempZipPath))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string completeFileName = Path.Combine(installPath, entry.FullName);
                                string directory = Path.GetDirectoryName(completeFileName);
                                
                                if (!Directory.Exists(directory))
                                {
                                    Directory.CreateDirectory(directory);
                                }

                                if (!string.IsNullOrEmpty(entry.Name))
                                {
                                    entry.ExtractToFile(completeFileName, true);
                                }
                            }
                        }

                        // Delete temporary ZIP
                        File.Delete(tempZipPath);
                    }

                    // Create shortcuts
                    string targetExe = Path.Combine(installPath, "ProcyonRadio.exe");
                    
                    if (desktopShortcutCheck.Checked)
                    {
                        string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                        string shortcutPath = Path.Combine(desktopPath, "ProcyonRadio.lnk");
                        CreateShortcut(shortcutPath, targetExe, installPath);
                    }

                    if (startMenuShortcutCheck.Checked)
                    {
                        string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");
                        string shortcutPath = Path.Combine(startMenuPath, "ProcyonRadio.lnk");
                        CreateShortcut(shortcutPath, targetExe, installPath);
                    }

                    success = true;
                }
                catch (Exception ex)
                {
                    errorMsg = ex.Message;
                }
            });

            progressBar.Visible = false;

            if (success)
            {
                statusLabel.Text = "¡Instalación completada con éxito!";
                statusLabel.ForeColor = Color.FromArgb(52, 199, 89); // Neon green
                
                DialogResult result = MessageBox.Show(
                    "¡ProcyonRadio se ha instalado correctamente en:\n" + installPath + "\n\n¿Deseas iniciar la aplicación ahora?",
                    "Instalación Completada",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );

                if (result == DialogResult.Yes)
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = Path.Combine(installPath, "ProcyonRadio.exe");
                        psi.WorkingDirectory = installPath;
                        Process.Start(psi);
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("No se pudo iniciar la aplicación de forma automática:\n" + ex.Message, "Error al iniciar", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }

                Application.Exit();
            }
            else
            {
                statusLabel.Text = "Error durante la instalación.";
                statusLabel.ForeColor = Color.FromArgb(255, 69, 58); // Neon red
                MessageBox.Show("Ocurrió un error al instalar:\n" + errorMsg, "Error de Instalación", MessageBoxButtons.OK, MessageBoxIcon.Error);
                
                // Re-enable controls
                installButton.Enabled = true;
                browseButton.Enabled = true;
                pathTextBox.Enabled = true;
                desktopShortcutCheck.Enabled = true;
                startMenuShortcutCheck.Enabled = true;
            }
        }

        private void CreateShortcut(string shortcutPath, string targetExe, string workingDir)
        {
            try
            {
                // Create Windows shortcut via PowerShell (extremely robust and works without COM references)
                string escapedShortcut = shortcutPath.Replace("'", "''");
                string escapedTarget = targetExe.Replace("'", "''");
                string escapedWorkingDir = workingDir.Replace("'", "''");
                string escapedIcon = Path.Combine(workingDir, "logo.ico").Replace("'", "''");

                string psCommand = string.Format(
                    "$s = New-Object -ComObject WScript.Shell; $g = $s.CreateShortcut('{0}'); $g.TargetPath = '{1}'; $g.WorkingDirectory = '{2}'; $g.IconLocation = '{3}'; $g.Save()",
                    escapedShortcut, escapedTarget, escapedWorkingDir, escapedIcon
                );

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = string.Format("-NoProfile -WindowStyle Hidden -Command \"{0}\"", psCommand);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;

                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Error al crear acceso directo: " + ex.Message);
            }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}
